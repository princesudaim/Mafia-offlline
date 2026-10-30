import { useEffect, useRef } from 'react';
import { roles, type Role } from './werewolf-engine';

/** A role information view; individual role settings will be added separately. */
export default function RoleDetails({ role, onClose }: { role: Role; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const details = roles[role];

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return <dialog
    ref={dialog}
    className="role-details"
    aria-labelledby="role-details-title"
    aria-describedby="role-details-description"
    onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
  >
    <div className="role-details-header">
      <div><small>ROLE DETAILS · {details.team === 'wolf' ? 'WEREWOLVES' : details.team === 'village' ? 'VILLAGERS' : 'NEUTRALS'}</small><h2 id="role-details-title">{details.name}</h2></div>
      <button type="button" className="role-details-close" aria-label="Close role details" onClick={() => dialog.current?.close()}>✕</button>
    </div>
    <img className="role-details-image" src={`./werewolf/${role}.webp`} alt={`${details.name} role artwork`} />
    <section className="panel role-details-description">
      <small>DESCRIPTION</small>
      <p id="role-details-description">{details.description}</p>
    </section>
    <section className="panel role-details-settings">
      <h3>⚙ ROLE SETTINGS</h3>
      <p>Role-specific settings will be added later.</p>
    </section>
    <button type="button" className="primary" onClick={() => dialog.current?.close()}>DONE</button>
  </dialog>;
}
