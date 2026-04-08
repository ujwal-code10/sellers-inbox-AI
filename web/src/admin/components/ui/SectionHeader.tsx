import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="admin-section-header">
      <div>
        <h2 className="admin-section-title">{title}</h2>
        {subtitle ? <p className="admin-section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-section-actions">{actions}</div> : null}
    </div>
  );
}

export default SectionHeader;
