import { identities } from '../../data/identities.js';

export default function IdentityGallery({
  selectedId,
  onSelect,
  founderMode = false,
  showReserved = true,
}) {
  return (
    <div className="identity-gallery">
      {identities.filter((identity) => identity.public || showReserved).map((identity) => {
        const selectable = identity.public || founderMode;
        return (
          <button
            type="button"
            className={`identity-card ${selectedId === identity.id ? 'selected' : ''} ${!selectable ? 'reserved' : ''}`}
            key={identity.id}
            onClick={() => selectable && onSelect?.(identity.id)}
            disabled={!selectable}
            aria-pressed={selectedId === identity.id}
          >
            <span className="identity-card-copy">
              <strong>{identity.name}</strong>
              <small>{identity.title}</small>
              <p>{identity.description}</p>
            </span>
            {!selectable && <b>RESERVED</b>}
          </button>
        );
      })}
    </div>
  );
}
