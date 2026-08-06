export const SECTION_VIEWS = Object.freeze({
  DASHBOARD: 'dashboard',
  THEME_CENTER: 'theme-center',
});

export function getSectionNavigationItems() {
  return [
    [SECTION_VIEWS.DASHBOARD, 'Command Center'],
    [SECTION_VIEWS.THEME_CENTER, 'Theme Center'],
  ];
}

export function getAuthorizedSectionView(view) {
  if (!Object.values(SECTION_VIEWS).includes(view)) {
    return SECTION_VIEWS.DASHBOARD;
  }
  return view;
}
