import { Link, useNavigate } from 'react-router-dom';
import { Cmd, Empty, Problem, Skeleton, When } from '@demo/shared/ui';
import { useRequestTypes } from '../hooks';

/** Danh sách loại đơn thiết kế từ giao diện. */
export default function RequestTypesPage() {
  const types = useRequestTypes();
  const navigate = useNavigate();
  const open = (key: string) => `/request-types/${encodeURIComponent(key)}`;

  return (
    <div className="view">
      <div className="view__head">
        <h1>Request types{types.data && <span className="view__count">{types.data.length}</span>}</h1>
        <span className="view__search" />
        <Cmd icon="add" label="New request type" primary to="/request-types/new" />
      </div>
      {types.isError ? <Problem error={types.error} onRetry={() => types.refetch()} />
        : !types.data ? <Skeleton rows={5} />
        : types.data.length === 0 ? (
          <Empty title="No request types designed yet.">
            <p>Design a form here and it becomes a new type in New request, approved by the manager. <Link className="link" to="/request-types/new">New request type</Link></p>
          </Empty>
        ) : (
          <div className="grid-wrap">
            <table className="grid grid--rows">
              <thead><tr><th>Name</th><th>Key</th><th>Fields</th><th>Version</th><th>Updated</th></tr></thead>
              <tbody>
                {types.data.map(t => (
                  <tr key={t.key} onClick={() => navigate(open(t.key))}>
                    <td><Link className="link" to={open(t.key)} onClick={e => e.stopPropagation()}>{t.name}</Link></td>
                    <td className="mono">{t.key}</td>
                    <td>{t.fields.length}</td>
                    <td>v{t.version}</td>
                    <td><When at={t.updatedAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
