import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteMembersComponent } from './invite-members.component';
import { provideBackendTesting } from '../../../core/backend/testing/provide-backend-testing';
import { SortieService } from '../../../core/services/sortie.service';
import { InviteCandidate } from '../../../core/models/sortie.model';

const person = (id: string, username: string, state: InviteCandidate['state'] = null) => ({
  id,
  username,
  avatar_url: null,
  state,
});

describe('InviteMembersComponent', () => {
  let component: InviteMembersComponent;
  let fixture: ComponentFixture<InviteMembersComponent>;
  let sent: string[][];
  let failNext: boolean;
  let release: (() => void) | null;

  async function setup(placesLeft: number | null = null) {
    sent = [];
    failNext = false;
    release = null;
    await TestBed.configureTestingModule({
      providers: [
        provideBackendTesting(),
        {
          provide: SortieService,
          useValue: {
            getInviteCandidates: async () => ({
              data: {
                // Alice est à la fois une amie et une personne rencontrée.
                friends: [person('alice', 'Alice'), person('bob', 'Bob', 'invited')],
                met: [person('alice', 'Alice'), person('zoe', 'Zoé'), person('max', 'Max')],
                placesLeft,
              },
              error: null,
            }),
            invite: async (_id: string, ids: string[]) => {
              sent.push(ids);
              if (release === null) await new Promise<void>((r) => (release = r));
              if (failNext) return { data: null, error: null };
              return { data: { invited: ids, skipped: [] }, error: null };
            },
          },
        },
      ],
      imports: [InviteMembersComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(InviteMembersComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sortieId', 's1');
    await component.ngOnInit();
  }

  const find = (list: InviteCandidate[], id: string) => list.find((p) => p.id === id)!;

  it('garde la sélection en changeant d’onglet, sans doublon', async () => {
    await setup();
    component.toggle(find(component.friends(), 'alice'));
    component.setTab('met');
    expect(component.isSelected(find(component.met(), 'alice'))).toBe(true);
    component.toggle(find(component.met(), 'zoe'));
    expect(component.buttonLabel()).toBe('Inviter 2 personnes');
    release = () => {};
    await component.send();
    expect(sent).toEqual([['alice', 'zoe']]);
    expect(component.selected().size).toBe(0);
    expect(find(component.friends(), 'alice').state).toBe('invited');
  });

  it('une personne déjà invitée ne peut pas être cochée', async () => {
    await setup();
    const bob = find(component.friends(), 'bob');
    expect(component.canSelect(bob)).toBe(false);
    component.toggle(bob);
    expect(component.selected().size).toBe(0);
    expect(component.buttonLabel()).toBe('Choisis des personnes');
  });

  it('filtre l’onglet affiché, sans tenir compte des accents', async () => {
    await setup();
    component.setTab('met');
    component.onSearch('zoe');
    expect(component.filtered().map((p) => p.id)).toEqual(['zoe']);
    component.onSearch('xyz');
    expect(component.filtered()).toEqual([]);
  });

  it('ne laisse pas cocher plus de personnes que de places libres', async () => {
    await setup(1);
    component.setTab('met');
    component.toggle(find(component.met(), 'zoe'));
    expect(component.canSelect(find(component.met(), 'max'))).toBe(false);
    expect(component.placesLeft()).toBe(0);
  });

  it('un double clic n’envoie qu’une fois', async () => {
    await setup();
    component.toggle(find(component.friends(), 'alice'));
    const first = component.send();
    const second = component.send();
    release!();
    await Promise.all([first, second]);
    expect(sent).toHaveLength(1);
  });

  it('garde la sélection si le réseau échoue', async () => {
    await setup();
    component.toggle(find(component.friends(), 'alice'));
    failNext = true;
    release = () => {};
    await component.send();
    expect(component.sendError()).toContain('connexion');
    expect(component.selected().has('alice')).toBe(true);
  });
});
