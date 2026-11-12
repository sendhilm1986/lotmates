import { memo } from 'react';
import { ICONS } from './icons.generated';

// Only the icons the app names are bundled (see scripts/gen.mjs), not the whole lucide set.
const toPascal = (s) => (typeof s === 'string' ? s : '')
  .split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join('');

function ApperIcon({ name, size = 20, className = '', ...props }) {
  if (!name) return null;
  const Icon = ICONS[toPascal(name)];
  if (!Icon) return null;
  return <Icon size={size} className={className} {...props} />;
}
export default memo(ApperIcon);
