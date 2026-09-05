import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, Modal, PageHeader, Spinner, Field } from '../../components/ui.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const moduleSchema = z.object({ title: z.string().min(1), description: z.string().optional() });
const lessonSchema = z.object({ title: z.string().min(1), content: z.string().optional(), type: z.enum(['text', 'video', 'pdf', 'external']).default('text'), videoUrl: z.string().url().optional().nullable() });

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { user } = useAuthStore();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [showModule, setShowModule] = useState(false);
  const [showLesson, setShowLesson] = useState(null);
  const [enrolled, setEnrolled] = useState(false);

  const modForm = useForm({ resolver: zodResolver(moduleSchema) });
  const lessonForm = useForm({ resolver: zodResolver(lessonSchema) });

  const load = async () => {
    try {
      const [modRes, progRes] = await Promise.all([
        api.get(`/courses/${courseId}/modules`),
        api.get(`/courses/${courseId}/progress`).catch(() => ({ data: { data: { progress: null } } })),
      ]);
      setModules(modRes.data.data.modules);
      setProgress(progRes.data.data.progress);
      setEnrolled(true);
    } catch (err) {
      if (err?.response?.status === 404) {
        try {
          const res = await api.get('/courses');
          const list = res.data.data?.courses ?? res.data.data?.items ?? res.data.items ?? [];
          const found = list.find((c) => c.id === courseId);
          if (found) { setCourse(found); setModules([]); setEnrolled(false); return; }
        } catch (_) {}
      }
      setError(err);
    }
  };

  useEffect(() => { load(); }, [courseId]);

  const onCreateModule = async (data) => {
    try {
      await api.post(`/courses/${courseId}/modules`, data);
      setShowModule(false);
      modForm.reset();
      load();
    } catch (err) { setError(err); }
  };

  const onCreateLesson = async (data) => {
    if (!showLesson) return;
    try {
      await api.post(`/modules/${showLesson}/lessons`, data);
      setShowLesson(null);
      lessonForm.reset();
      load();
    } catch (err) { setError(err); }
  };

  const handleEnroll = async () => {
    try { await api.post(`/courses/${courseId}/enroll`); setEnrolled(true); load(); } catch (err) { setError(err); }
  };

  if (error) return <ErrorAlert error={error} />;
  if (modules === null && !course) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title={course?.name ?? 'Course'} description={course?.description || 'Course modules and lessons'}>
        {isStaff && <button onClick={() => setShowModule(true)} className="btn-primary">Add Module</button>}
        {!isStaff && !enrolled && <button onClick={handleEnroll} className="btn-primary">Enroll in Course</button>}
      </PageHeader>

      {progress && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Your Progress</span>
            <span className="text-sm font-bold text-brand-600">{progress.percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${progress.percentage}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{progress.completedLessons} of {progress.totalLessons} lessons completed</p>
        </div>
      )}

      {modules.length === 0 ? (
        <EmptyState title="No modules yet" description={isStaff ? "Create the first module to get started." : "Course content will appear here."} />
      ) : (
        <div className="space-y-4">
          {modules.map((mod, idx) => (
            <div key={mod.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    <span className="mr-2 text-xs text-slate-400">Module {idx + 1}</span>
                    {mod.title}
                  </h3>
                  {mod.description && <p className="mt-1 text-sm text-slate-500">{mod.description}</p>}
                </div>
                {isStaff && (
                  <button onClick={() => setShowLesson(mod.id)} className="btn-secondary text-xs">+ Lesson</button>
                )}
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {(mod.lessons ?? []).length === 0 ? (
                  <p className="py-2 text-sm text-slate-400">No lessons in this module</p>
                ) : (
                  (mod.lessons ?? []).map((lesson) => (
                    <Link key={lesson.id} to={`/lessons/${lesson.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-2 -mx-2 rounded">
                      <div className="flex items-center gap-2">
                        <Badge tone={lesson.type === 'video' ? 'violet' : lesson.type === 'pdf' ? 'red' : 'slate'}>{lesson.type}</Badge>
                        <span className="text-sm text-slate-700">{lesson.title}</span>
                      </div>
                      {lesson.durationMin && <span className="text-xs text-slate-400">{lesson.durationMin} min</span>}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!showModule} onClose={() => setShowModule(false)} title="Create Module">
        <form onSubmit={modForm.handleSubmit(onCreateModule)} className="space-y-4">
          <Field label="Title" error={modForm.formState.errors.title?.message}>
            <input {...modForm.register('title')} className="input" placeholder="Module title" />
          </Field>
          <Field label="Description">
            <textarea {...modForm.register('description')} className="input" rows={3} placeholder="Optional description" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowModule(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showLesson} onClose={() => setShowLesson(null)} title="Add Lesson">
        <form onSubmit={lessonForm.handleSubmit(onCreateLesson)} className="space-y-4">
          <Field label="Title" error={lessonForm.formState.errors.title?.message}>
            <input {...lessonForm.register('title')} className="input" placeholder="Lesson title" />
          </Field>
          <Field label="Type">
            <select {...lessonForm.register('type')} className="input">
              <option value="text">Text</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="external">External Link</option>
            </select>
          </Field>
          <Field label="Content">
            <textarea {...lessonForm.register('content')} className="input" rows={6} placeholder="Lesson content (markdown supported)" />
          </Field>
          <Field label="Video URL">
            <input {...lessonForm.register('videoUrl')} className="input" placeholder="https://..." />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowLesson(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
