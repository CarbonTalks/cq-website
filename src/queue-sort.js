// English labels; translated at render.
export const queueSortLabels = {
  name: 'Project & Authority', tech: 'Technology', capacity: 'Capacity',
  carbon: 'Est. Carbon Impact', risk: 'Withdrawal', effort: 'Effort',
  wait: 'Waiting', reason: 'Reason',
};

export function compareQueueProjects(a, b, { key, direction }) {
  // Unspecified capacity and unscored carbon stay last in both directions.
  if (key === 'capacity' && (!a.capacity || !b.capacity)) return Number(!a.capacity) - Number(!b.capacity);
  if (key === 'carbon' && (!a.carbon || !b.carbon)) return Number(!a.carbon) - Number(!b.carbon);
  if (key === 'risk' && (a.risk == null || b.risk == null)) return Number(a.risk == null) - Number(b.risk == null);
  const value = project => key === 'carbon' ? project.carbon[1] : project[key];
  const left = value(a), right = value(b);
  let comparison = typeof left === 'string' ? left.localeCompare(right) : left - right;
  if (!comparison && key === 'name') comparison = a.authority.localeCompare(b.authority);
  return comparison * (direction === 'desc' ? -1 : 1);
}
