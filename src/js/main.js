const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');
const nav = document.querySelector('nav');

function setActiveLink(sectionId) {
    navLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${sectionId}`;
        link.classList.toggle('active', isActive);

        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

const footer = document.querySelector('.site-footer');
const lastNavLink = navLinks[navLinks.length - 1];
const lastNavTargetId = lastNavLink.getAttribute('href').slice(1);

function updateActiveNavigation() {
    // The footer belongs to the final section, even though it has no nav link.
    if (footer.getBoundingClientRect().top < window.innerHeight) {
        setActiveLink(lastNavTargetId);
        return;
    }

    // The active section is the one directly below the navbar.
    const readingPoint = nav.offsetHeight + 1;
    const activeSection = [...sections].find((section) => {
        const { top, bottom } = section.getBoundingClientRect();
        return top <= readingPoint && bottom > readingPoint;
    }) || sections[0];

    setActiveLink(activeSection.id);
}

function updateNavbarSize() {
    nav.classList.toggle('is-compact', window.scrollY > 10);
}

window.addEventListener('scroll', () => {
    updateNavbarSize();
    updateActiveNavigation();
}, { passive: true });
updateNavbarSize();
updateActiveNavigation();

const albumTrack = document.querySelector('.album-track');
const carouselButtons = document.querySelectorAll('.carousel-button');
const albumCards = document.querySelectorAll('.album-card');
const albumModal = document.querySelector('.album-modal');
const modalCloseButton = document.querySelector('.modal-close');
const modalCover = document.querySelector('.modal-cover');
const modalTitle = document.querySelector('#modal-album-title');
const modalReleaseYear = document.querySelector('.modal-release-year');
const trackList = document.querySelector('.track-list');
let lastFocusedCard;
let activeCollectionId;
let modalCloseTimer;

function updateCarouselButtons() {
    const maxScroll = albumTrack.scrollWidth - albumTrack.clientWidth;
    carouselButtons.forEach((button) => {
        if (button.dataset.direction === 'previous') {
            button.disabled = albumTrack.scrollLeft <= 4;
        } else {
            button.disabled = albumTrack.scrollLeft >= maxScroll - 1;
        }
    });
}

carouselButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const direction = button.dataset.direction === 'next' ? 1 : -1;
        albumTrack.scrollBy({ left: albumTrack.clientWidth * direction, behavior: 'smooth' });
    });
});

albumTrack.addEventListener('scroll', updateCarouselButtons, { passive: true });
updateCarouselButtons();

albumCards.forEach((card) => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
});

const albumCatalogRequest = fetch('https://itunes.apple.com/lookup?id=159260351&entity=album&limit=200')
    .then((response) => response.json())
    .then(({ results }) => {
        const albumResults = results.filter((album) => album.collectionName && album.artworkUrl100);
        const albums = new Map(albumResults.map((album) => [album.collectionName.toLowerCase(), album.artworkUrl100]));

        document.querySelectorAll('.album-cover').forEach((cover) => {
            const title = cover.dataset.itunesTitle.toLowerCase();
            const artwork = albums.get(title)
                || albumResults.find((album) => album.collectionName.toLowerCase().startsWith(title))?.artworkUrl100;

            if (artwork) {
                cover.src = artwork.replace('100x100bb', '600x600bb');
            }
        });

        return albumResults;
    })
    .catch(() => {
        // The album details remain available if the public image catalog is unavailable.
        return [];
    });

function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function renderTracks(tracks) {
    trackList.replaceChildren();

    tracks.forEach((track) => {
        const row = document.createElement('li');
        const number = document.createElement('span');
        const name = document.createElement('span');
        const duration = document.createElement('span');
        row.className = 'track-row';
        number.className = 'track-number';
        duration.className = 'track-duration';
        number.textContent = track.trackNumber;
        name.textContent = track.trackName;
        duration.textContent = formatDuration(track.trackTimeMillis);
        row.append(number, name, duration);
        trackList.append(row);
    });
}

function openAlbumModal(card) {
    window.clearTimeout(modalCloseTimer);
    lastFocusedCard = card;
    const title = card.querySelector('h3').textContent;
    const year = card.querySelector('p').textContent;
    const cover = card.querySelector('img');
    modalCover.src = cover.currentSrc || cover.src;
    modalCover.alt = cover.alt;
    modalTitle.textContent = title;
    modalReleaseYear.textContent = year;
    trackList.replaceChildren();
    const loadingItem = document.createElement('li');
    loadingItem.className = 'track-row';
    loadingItem.textContent = 'Loading tracks…';
    trackList.append(loadingItem);
    albumModal.removeAttribute('hidden');
    window.requestAnimationFrame(() => albumModal.classList.add('is-open'));
    albumModal.setAttribute('aria-hidden', 'false');
    modalCloseButton.focus();

    albumCatalogRequest.then((albums) => {
        const normalizedTitle = title.toLowerCase();
        const album = albums.find((item) => item.collectionName.toLowerCase() === normalizedTitle)
            || albums.find((item) => item.collectionName.toLowerCase().startsWith(normalizedTitle));

        if (!album) {
            loadingItem.textContent = 'Track details are unavailable for this release.';
            return;
        }

        activeCollectionId = album.collectionId;
        fetch(`https://itunes.apple.com/lookup?id=${album.collectionId}&entity=song`)
            .then((response) => response.json())
            .then(({ results }) => {
                if (activeCollectionId === album.collectionId) {
                    renderTracks(results.filter((item) => item.kind === 'song').sort((a, b) => a.trackNumber - b.trackNumber));
                }
            })
            .catch(() => {
                loadingItem.textContent = 'Track details could not be loaded.';
            });
    });
}

function closeAlbumModal() {
    albumModal.classList.remove('is-open');
    albumModal.setAttribute('aria-hidden', 'true');
    modalCloseTimer = window.setTimeout(() => {
        if (!albumModal.classList.contains('is-open')) {
            albumModal.setAttribute('hidden', '');
        }
    }, 500);
    lastFocusedCard?.focus();
}

albumCards.forEach((card) => {
    card.addEventListener('click', () => openAlbumModal(card));
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openAlbumModal(card);
        }
    });
});

modalCloseButton.addEventListener('click', closeAlbumModal);
albumModal.addEventListener('click', (event) => {
    if (event.target === albumModal) closeAlbumModal();
});
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && albumModal.classList.contains('is-open')) closeAlbumModal();
});
