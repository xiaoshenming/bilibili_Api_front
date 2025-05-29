/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(initialState: { currentUser?: API.CurrentUser } | undefined) {
  const { currentUser } = initialState ?? {};
  return {
    canAdmin: currentUser && (currentUser.role === '2' || currentUser.role === '3'),
    canSuperAdmin: currentUser && currentUser.role === '3',
    canUser: currentUser && currentUser.role === '1',
    noAccess: currentUser && currentUser.role === '0',
  };
}
