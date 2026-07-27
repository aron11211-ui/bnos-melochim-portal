# Role Test Matrix

Use this matrix for live deployed testing. Do not mark a role complete until it has been tested in the browser against the deployed Render + Supabase environment.

| Role | Login | Dashboard | Navigation | Create/edit allowed records | Unauthorized route checks | Logout/session checks | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Parent Portal | Not fully retested | Not fully retested | Not fully retested | Registration step save started | Not fully retested | Not fully retested | In progress |
| Registration Office | Not fully retested | Not fully retested | Not fully retested | Family/student creation expected | Not fully retested | Not fully retested | In progress |
| Tuition Office | Not fully retested | Not fully retested | Not fully retested | Tuition workflow incomplete | Not fully retested | Not fully retested | In progress |
| School Management | Not fully retested | Not fully retested | Not fully retested | Should be read-only | Not fully retested | Not fully retested | In progress |
| System Administration | Partially tested earlier | Dashboard live-loaded July 27, 2026 | Users & Access live-opened July 27, 2026 | Invite and access management started; Manage User Access panel opened live without console errors | Not fully retested | Not fully retested | In progress |

## Required browser checks per role

- Open every navigation item.
- Refresh every protected route.
- Try a route from another role.
- Try visible primary actions.
- Confirm saved data survives refresh.
- Check browser console for errors.
- Check network calls for failed Supabase requests.
- Test mobile width.
