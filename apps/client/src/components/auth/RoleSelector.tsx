import { motion, useReducedMotion } from 'motion/react';
import type { UserRole } from '../../types/user.js';
import { PersonIcon, StethoscopeIcon } from '../ui/icons.js';

/**
 * Account-type choice for the authentication screens. It only selects which
 * panel the visitor intends to use; the server-returned role always decides
 * what they can actually reach.
 */
const OPTIONS = [
  {
    role: 'patient',
    label: 'Patient',
    description: 'Track and manage your glucose readings.',
    Icon: PersonIcon,
  },
  {
    role: 'doctor',
    label: 'Doctor',
    description: 'Access and monitor your assigned patients.',
    Icon: StethoscopeIcon,
  },
] as const;

interface RoleSelectorProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
  label: string;
}

export function RoleSelector({ value, onChange, label }: RoleSelectorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {OPTIONS.map(({ role, label: optionLabel, description, Icon }) => {
        const selected = value === role;

        return (
          <button
            key={role}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(role)}
            className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors duration-150 ${
              selected
                ? 'border-olive-dark bg-sage/20'
                : 'border-line bg-surface hover:border-olive/40 hover:bg-sage/30'
            }`}
          >
            <motion.span
              className={`flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                selected ? 'bg-olive-dark text-cream' : 'bg-sage/70 text-olive-dark'
              }`}
              animate={reduceMotion ? undefined : { scale: selected ? 1 : 0.94 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              <Icon className="size-4" />
            </motion.span>
            <span className="min-w-0">
              <span
                className={`block text-sm font-medium ${selected ? 'text-olive-dark' : 'text-ink'}`}
              >
                {optionLabel}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-ink-soft">{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
