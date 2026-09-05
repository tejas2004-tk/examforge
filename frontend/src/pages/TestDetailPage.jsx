import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, ErrorAlert, Field, Modal, PageHeader, Spinner, statusTone } from '../components/ui.jsx';

export function TestDetailPage({ backTo = '/teacher/tests' }) {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState([]);
  const [selected, setSelected] = useState([]);

  const load = () => api.get(`/tests/${testId}`).then((res) => setTest(res.data.data.test)).catch(setError);
  useEffect(() => { load(); }, [testId]);

  const setStatus = async (status) => {
    if (status === 'PUBLISHED' && !window.confirm('Publish this test? Students can then start it when assigned and the window is open.')) return;
    setBusy(true);
    try {
      await api.post(`/tests/${testId}/${status === 'PUBLISHED' ? 'publish' : status === 'CLOSED' ? 'close' : 'unpublish'}`);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const searchStudents = async (term) => {
    setSearch(term);
    const { data } = await api.get(`/tests/students/list?search=${encodeURIComponent(term)}`);
    setStudentOptions(data.data.students);
  };

  const openAssign = async () => {
    setAssignOpen(true);
    setSelected([]);
    setSearch('');
    await searchStudents('');
  };

  const assign = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await api.post(`/tests/${testId}/assign`, { studentIds: selected });
      setAssignOpen(false);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!test) return <Spinner />;

  const assignedIds = new Set(test.assignments?.map((a) => a.studentId) ?? []);

  return (
    <div>
      <PageHeader
        title={test.title}
        description={`${test.course?.name ?? 'No course'} · ${test.durationMinutes} min · ${test.totalMarks} marks · pass ${test.passingMarks}`}
        actions={
          <>
            <Link to={backTo} className="btn-secondary">All tests</Link>
            {test.status === 'DRAFT' && (
              <button onClick={() => setStatus('PUBLISHED')} disabled={busy} className="btn-primary">Publish</button>
            )}
            {test.status === 'PUBLISHED' && (
              <button onClick={() => setStatus('CLOSED')} disabled={busy} className="btn-secondary">Close</button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Badge tone={statusTone(test.status)}>{test.status}</Badge>
        {test.maxAttempts && <span className="text-sm text-slate-600">Max attempts: {test.maxAttempts}</span>}
        {test.negativeMarks > 0 && <span className="text-sm text-slate-600">Negative marking: {test.negativeMarks}</span>}
        {test.shuffleQuestions && <span className="text-sm text-slate-600">Shuffled order</span>}
        {test.startAt && <span className="text-sm text-slate-600">Opens {new Date(test.startAt).toLocaleString()}</span>}
        {test.endAt && <span className="text-sm text-slate-600">Closes {new Date(test.endAt).toLocaleString()}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Questions ({test.questions?.length ?? 0})</h2>
          <ul className="divide-y divide-slate-100">
            {test.questions?.map((q, i) => (
              <li key={q.id} className="flex items-center justify-between gap-2 py-2.5">
                <p className="text-sm text-slate-800">
                  <span className="mr-2 font-semibold text-slate-400">{i + 1}.</span>
                  {q.text}
                </p>
                <span className="shrink-0 text-xs text-slate-400">{q.type} · {q.marks} pts</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Assigned students ({test.assignments?.length ?? 0})
            </h2>
            {test.status !== 'DRAFT' && (
              <button onClick={openAssign} className="btn-primary px-3 py-1.5">Assign students</button>
            )}
          </div>
          {test.status === 'DRAFT' && (
            <p className="mb-3 text-sm text-amber-700">Publish the test before assigning students.</p>
          )}
          {test.assignments?.length === 0 ? (
            <p className="text-sm text-slate-500">No students assigned yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {test.assignments?.map((a) => (
                <li key={a.studentId} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{a.student.fullName ?? a.student.email}</p>
                    <p className="text-xs text-slate-500">{a.student.email}</p>
                  </div>
                  {assignedIds.has(a.studentId) && <Badge tone="green">Assigned</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign test to students" width="max-w-xl">
        <div className="space-y-4">
          <Field label="Search students">
            <input className="input" placeholder="Name or email…" value={search} onChange={(e) => searchStudents(e.target.value)} />
          </Field>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {studentOptions.length === 0 && <p className="px-2 py-1 text-sm text-slate-400">No students found.</p>}
            {studentOptions.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={(e) =>
                    setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((id) => id !== s.id)))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span>{s.fullName ?? s.email}</span>
                <span className="ml-auto text-xs text-slate-400">{s.email}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAssignOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={assign} disabled={busy || selected.length === 0} className="btn-primary">
              {busy ? 'Assigning…' : `Assign (${selected.length})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
