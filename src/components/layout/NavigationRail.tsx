import React from 'react';
import { useI18n } from '../../i18n';
import { useStore } from '../../state/store';
import type { NavTab } from '../../types';

interface NavItemDef {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
}

export function NavigationRail() {
  const { t } = useI18n();
  const activeNavTab = useStore((s) => s.activeNavTab);
  const setActiveNavTab = useStore((s) => s.setActiveNavTab);

  const navItems: NavItemDef[] = [
    {
      id: 'project',
      label: t('nav.model') || 'Model',
      icon: (
        <svg className="cad-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      id: 'pattern',
      label: t('nav.pattern') || 'Pattern',
      icon: (
        <svg className="cad-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: 'export',
      label: t('nav.export') || 'Export',
      icon: (
        <svg className="cad-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="cad-nav-rail" aria-label="Workspace Modules">
      {navItems.map((item) => {
        const isActive = activeNavTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`cad-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (item.id === 'export') {
                useStore.getState().setExportModalOpen(true);
              } else {
                setActiveNavTab(item.id);
              }
            }}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
