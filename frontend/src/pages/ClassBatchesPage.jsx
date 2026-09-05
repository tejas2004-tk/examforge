import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, Modal, PageHeader, Spinner } from '../components/ui.jsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1, 'Name is required'), courseId: z.string().min(1, 'Course is required') });

export function ClassBatchesPage() {
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const load = async () => {
    setLoading(true);
    try {
      const [batchRes, courseRes] = await Promise.all([api.get('/class-batches'), api.get('/courses')]);
      setBatches(batchRes.data.data.batches);
      setCourses(courseRes.data.data?.items ?? courseRes.data.items ?? []);
    } catch (err) { setError(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (data) => {
    try {
      await api.post('/class-batches', data);
      setShowCreate(false);
      reset();
      load();
    } catch (err) { setError(err); }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this class batch?')) return;
    try { await api.delete(`/class-batches/${id}`); load(); } catch (err) { setError(err); }
  };

  const openDetail = async (batch) => {
    try {
      const res = await api.get(`/class-batches/${batch.id}`);
      setSelectedBatch(res.data.data.batch);
      setShowDetail(true);
    } catch (err) { setError(err); }
  };

  const searchStudents = async (q) => {
    setStudentSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get(`/tests/students/list?search=${encodeURIComponent(q)}`);
      setSearchResults(res.data.data.students);
    } catch (err) { /* ignore */ }
  };

  const addStudents = async (studentIds) => {
    if (!selectedBatch) return;
    try {
      await api.post(`/class-batches/${selectedBatch.id}/students`, { studentIds });
      const res = await api.get(`/class-batches/${selectedBatch.id}`);
      setSelectedBatch(res.data.data.batch);
      setStudentSearch('');
      setSearchResults([]);
      load();
    } catch (err) { setError(err); }
  };

  const removeStudent = async (studentId) => {
    if (!selectedBatch) return;
    try {
      await api.delete(`/class-batches/${selectedBatch.id}/students/${studentId}`);
      const res = await api.get(`/class-batches/${selectedBatch.id}`);
      setSelectedBatch(res.data.data.batch);
      load();
    } catch (err) { setError(err); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Class Batches" description="Manage class batches and enroll students">
        <button onClick={() => setShowCreate(true)} className="btn-primary">New Batch</button>
      </PageHeader>

      {batches.length === 0 ? (
        <EmptyState title="No class batches" description="Create your first class batch to organize students." action={<button onClick={() => setShowCreate(true)} className="btn-primary mt-2">Create Batch</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <div key={b.id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(b)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-ink">{b.name}</h3>
                  <p className="text-sm text-ink-muted">{b.course?.name ?? 'No course'}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} className="text-ink-subtle hover:text-critical">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-ink-muted">
                <span>{b._count?.students ?? 0} students</span>
                <span>{b._count?.testAssignments ?? 0} tests assigned</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Class Batch">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input {...register('name')} className="input" placeholder="e.g. CS101 - Section A" />
            {errors.name && <p className="text-xs text-critical mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Course</label>
            <select {...register('courseId')} className="input">
              <option value="">Select course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            {errors.courseId && <p className="text-xs text-critical mt-1">{errors.courseId.message}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowCreate(false); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={showDetail} onClose={() => { setShowDetail(false); setSelectedBatch(null); }} title={selectedBatch?.name ?? 'Batch Detail'} width="max-w-2xl">
        {selectedBatch && (
          <div className="space-y-4">
            <div className="text-sm text-ink-muted">Course: {selectedBatch.course?.name ?? 'None'}</div>
            <div>
              <label className="label">Add Students</label>
              <input className="input" placeholder="Search by name, email, or username" value={studentSearch} onChange={(e) => searchStudents(e.target.value)} />
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line">
                  {searchResults.map((s) => (
                    <button key={s.id} onClick={() => addStudents([s.id])} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-canvas">
                      <span>{s.fullName || s.username} ({s.email})</span>
                      <Badge tone="blue">Add</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="label">Enrolled Students ({selectedBatch.students?.length ?? 0})</p>
              {selectedBatch.students?.length === 0 ? (
                <p className="text-sm text-ink-subtle">No students enrolled yet.</p>
              ) : (
                <div className="divide-y divide-line rounded-lg border border-line">
                  {selectedBatch.students?.map((cs) => (
                    <div key={cs.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">{cs.student?.fullName || cs.student?.username} ({cs.student?.email})</span>
                      <button onClick={() => removeStudent(cs.studentId)} className="text-xs text-critical hover:text-critical-ink">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
