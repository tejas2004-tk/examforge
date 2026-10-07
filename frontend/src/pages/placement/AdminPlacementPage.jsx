import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import {
  Badge,
  EmptyState,
  ErrorAlert,
  Field,
  Modal,
  PageHeader,
  Spinner,
} from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import {
  Briefcase,
  CheckCircle,
  ExternalLink,
  Plus,
  Trash2,
  Users,
  Building,
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Award,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

const SELECTION_ROUNDS = [
  'Resume Screening',
  'Online Assessment',
  'Technical Interview 1',
  'Technical Interview 2',
  'HR Round',
  'Offer Released',
];

export function AdminPlacementPage() {
  const [activeTab, setActiveTab] = useState('drives'); // 'drives' | 'candidates' | 'profiles'
  const [stats, setStats] = useState(null);
  const [drives, setDrives] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [candidateFilterDrive, setCandidateFilterDrive] = useState('ALL');
  const [candidateFilterStatus, setCandidateFilterStatus] = useState('ALL');
  const [candidateSearch, setCandidateSearch] = useState('');

  const [profileSearch, setProfileSearch] = useState('');
  const [profileBranchFilter, setProfileBranchFilter] = useState('ALL');

  // Drive create/edit modal
  const [driveModal, setDriveModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);
  const [formDrive, setFormDrive] = useState({
    companyName: '',
    role: '',
    description: '',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: '7.0',
    eligibleBranches: 'Computer Science, Information Technology',
    maxBacklogs: '0',
    minTenthPercent: '70',
    minTwelfthPercent: '70',
    batchYear: '2026',
    ctcLpa: '12.0',
    location: 'Bangalore / Hybrid',
    deadline: '',
    driveDate: '',
    status: 'ACTIVE',
    selectionProcess: SELECTION_ROUNDS.join(', '),
  });
  const [savingDrive, setSavingDrive] = useState(false);

  // Applicants modal
  const [viewingApplicantsDrive, setViewingApplicantsDrive] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, drivesRes, profilesRes] = await Promise.all([
        api.get('/placements/stats').catch(() => ({ data: { data: { stats: null } } })),
        api.get('/placements/drives'),
        api.get('/placements/profiles').catch(() => ({ data: { data: { profiles: [] } } })),
      ]);
      setStats(statsRes.data?.data?.stats || null);
      setDrives(drivesRes.data?.data?.drives || []);
      setProfiles(profilesRes.data?.data?.profiles || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load placement data');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async () => {
    try {
      // Fetch proctor candidates which aggregates candidates across drives
      const res = await api.get('/placements/proctor/candidates');
      setCandidates(res.data?.data?.candidates || []);
    } catch (err) {
      console.error('Failed to load candidate pipeline', err);
    }
  };

  useEffect(() => {
    loadData();
    loadCandidates();
  }, []);

  const openCreateModal = () => {
    setEditingDrive(null);
    setFormDrive({
      companyName: '',
      role: '',
      description: '',
      driveType: 'ON_CAMPUS',
      eligibilityCgpa: '7.0',
      eligibleBranches: 'Computer Science, Information Technology',
      maxBacklogs: '0',
      minTenthPercent: '70',
      minTwelfthPercent: '70',
      batchYear: '2026',
      ctcLpa: '12.0',
      location: 'Bangalore / Hybrid',
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      driveDate: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
      status: 'ACTIVE',
      selectionProcess: SELECTION_ROUNDS.join(', '),
    });
    setDriveModal(true);
  };

  const openEditModal = (drive) => {
    setEditingDrive(drive);
    setFormDrive({
      companyName: drive.companyName || '',
      role: drive.role || '',
      description: drive.description || '',
      driveType: drive.driveType || 'ON_CAMPUS',
      eligibilityCgpa: drive.eligibilityCgpa?.toString() || '0.0',
      eligibleBranches: Array.isArray(drive.eligibleBranches) ? drive.eligibleBranches.join(', ') : '',
      maxBacklogs: drive.maxBacklogs !== undefined ? drive.maxBacklogs.toString() : '0',
      minTenthPercent: drive.minTenthPercent !== undefined && drive.minTenthPercent !== null ? drive.minTenthPercent.toString() : '',
      minTwelfthPercent: drive.minTwelfthPercent !== undefined && drive.minTwelfthPercent !== null ? drive.minTwelfthPercent.toString() : '',
      batchYear: drive.batchYear !== undefined && drive.batchYear !== null ? drive.batchYear.toString() : '2026',
      ctcLpa: drive.ctcLpa?.toString() || '',
      location: drive.location || '',
      deadline: drive.deadline ? new Date(drive.deadline).toISOString().split('T')[0] : '',
      driveDate: drive.driveDate ? new Date(drive.driveDate).toISOString().split('T')[0] : '',
      status: drive.status || 'ACTIVE',
      selectionProcess: Array.isArray(drive.selectionProcess) ? drive.selectionProcess.join(', ') : SELECTION_ROUNDS.join(', '),
    });
    setDriveModal(true);
  };

  const handleSaveDrive = async (e) => {
    e.preventDefault();
    if (!formDrive.companyName.trim() || !formDrive.role.trim() || !formDrive.deadline) {
      toast.error('Company Name, Role, and Deadline are required');
      return;
    }

    try {
      setSavingDrive(true);
      const payload = {
        companyName: formDrive.companyName.trim(),
        role: formDrive.role.trim(),
        description: formDrive.description.trim() || undefined,
        driveType: formDrive.driveType,
        eligibilityCgpa: parseFloat(formDrive.eligibilityCgpa) || 0,
        eligibleBranches: formDrive.eligibleBranches
          ? formDrive.eligibleBranches.split(',').map((b) => b.trim()).filter(Boolean)
          : [],
        maxBacklogs: formDrive.maxBacklogs ? parseInt(formDrive.maxBacklogs, 10) : 0,
        minTenthPercent: formDrive.minTenthPercent ? parseFloat(formDrive.minTenthPercent) : undefined,
        minTwelfthPercent: formDrive.minTwelfthPercent ? parseFloat(formDrive.minTwelfthPercent) : undefined,
        batchYear: formDrive.batchYear ? parseInt(formDrive.batchYear, 10) : undefined,
        ctcLpa: formDrive.ctcLpa ? parseFloat(formDrive.ctcLpa) : undefined,
        location: formDrive.location.trim() || undefined,
        deadline: new Date(formDrive.deadline).toISOString(),
        driveDate: formDrive.driveDate ? new Date(formDrive.driveDate).toISOString() : undefined,
        status: formDrive.status,
      };

      if (editingDrive) {
        await api.put(`/placements/drives/${editingDrive.id}`, payload);
        toast.success('Placement drive updated successfully!');
      } else {
        await api.post('/placements/drives', payload);
        toast.success('Placement drive created successfully!');
      }

      setDriveModal(false);
      loadData();
      loadCandidates();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save drive');
    } finally {
      setSavingDrive(false);
    }
  };

  const handleDeleteDrive = async (driveId) => {
    if (!window.confirm('Are you sure you want to delete this placement drive? All applications will be removed.')) {
      return;
    }
    try {
      await api.delete(`/placements/drives/${driveId}`);
      toast.success('Placement drive deleted successfully');
      loadData();
      loadCandidates();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete drive');
    }
  };

  const handleOpenApplicants = async (drive) => {
    setViewingApplicantsDrive(drive);
    try {
      setLoadingApplicants(true);
      const res = await api.get(`/placements/drives/${drive.id}`);
      setApplicants(res.data?.data?.drive?.applications || []);
    } catch (err) {
      toast.error('Failed to load drive applicants');
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleUpdateApplicantStatus = async (appId, newStatus, currentRound, notes) => {
    try {
      await api.patch(`/placements/applications/${appId}/status`, {
        status: newStatus,
        currentRound: currentRound || undefined,
        notes: notes || undefined,
      });
      toast.success(`Candidate updated: ${newStatus}`);
      if (viewingApplicantsDrive) {
        const res = await api.get(`/placements/drives/${viewingApplicantsDrive.id}`);
        setApplicants(res.data?.data?.drive?.applications || []);
      }
      loadCandidates();
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update applicant');
    }
  };

  const handleVerifyProfile = async (profileId, isVerified) => {
    try {
      await api.patch(`/placements/profiles/${profileId}/verify`, { isVerified });
      toast.success(isVerified ? 'Student POD profile verified' : 'Profile verification revoked');
      const profilesRes = await api.get('/placements/profiles');
      setProfiles(profilesRes.data?.data?.profiles || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile verification');
    }
  };

  // Filtered Candidates
  const filteredCandidates = candidates.filter((c) => {
    const matchesDrive = candidateFilterDrive === 'ALL' || c.driveId === candidateFilterDrive;
    const matchesStatus = candidateFilterStatus === 'ALL' || c.status === candidateFilterStatus;
    const q = candidateSearch.toLowerCase();
    const studentName = (c.student?.placementProfile?.fullName || c.student?.fullName || c.student?.username || '').toLowerCase();
    const company = (c.drive?.companyName || '').toLowerCase();
    const roll = (c.student?.placementProfile?.rollNumber || '').toLowerCase();
    const matchesSearch = !q || studentName.includes(q) || company.includes(q) || roll.includes(q);
    return matchesDrive && matchesStatus && matchesSearch;
  });

  // Filtered Profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesBranch = profileBranchFilter === 'ALL' || p.branch === profileBranchFilter;
    const q = profileSearch.toLowerCase();
    const name = (p.fullName || p.user?.fullName || p.user?.username || '').toLowerCase();
    const roll = (p.rollNumber || '').toLowerCase();
    const matchesSearch = !q || name.includes(q) || roll.includes(q);
    return matchesBranch && matchesSearch;
  });

  if (loading) return <Spinner label="Loading Placement Operations…" />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training & Placement Cell Operations"
        description="Corporate drive management, multi-round candidate pipeline, and verified student POD dossier directory."
        eyebrow="Placement Administration"
      >
        <button
          type="button"
          onClick={openCreateModal}
          className="btn btn-primary inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>New Recruitment Drive</span>
        </button>
      </PageHeader>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Active Drives</span>
              <Briefcase className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">{stats.activeDrives ?? 0}</p>
            <span className="text-[11px] text-ink-muted">Total: {stats.totalDrives ?? 0} drives</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Applications</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">{stats.totalApplications ?? 0}</p>
            <span className="text-[11px] text-ink-muted">Across all rounds</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Placed / Selected</span>
              <CheckCircle className="h-4 w-4 text-positive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-positive-ink">{stats.selectedCount ?? 0}</p>
            <span className="text-[11px] text-ink-muted">Offers secured</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-subtle uppercase">Avg CTC Package</span>
              <span className="text-xs font-bold text-accent">₹</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">
              {stats.averageCtc ? `₹${stats.averageCtc.toFixed(1)} LPA` : '—'}
            </p>
            <span className="text-[11px] text-ink-muted">
              Highest: {stats.highestCtc ? `₹${stats.highestCtc} LPA` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Top Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-1">
        <div className="flex gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('drives')}
            className={`relative pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'drives'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Recruitment Drives</span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-bold text-ink-muted">
              {drives.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('candidates')}
            className={`relative pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'candidates'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Candidate Hiring Pipeline</span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-bold text-ink-muted">
              {candidates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`relative pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'profiles'
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Student POD Dossiers</span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-bold text-ink-muted">
              {profiles.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: RECRUITMENT DRIVES */}
      {activeTab === 'drives' && (
        <div className="space-y-4">
          {drives.length === 0 ? (
            <EmptyState
              title="No placement drives found"
              description="Create a new recruitment drive to start welcoming eligible student applications."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[10px] bg-canvas/40">
                    <th className="py-3 px-4 font-semibold">Company & Role</th>
                    <th className="py-3 px-3 font-semibold">Type & Compensation</th>
                    <th className="py-3 px-3 font-semibold">Eligibility Criteria</th>
                    <th className="py-3 px-3 font-semibold">Deadline & Date</th>
                    <th className="py-3 px-3 font-semibold">Pipeline Stage</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {drives.map((drive) => (
                    <tr key={drive.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-ink text-sm block font-bold">{drive.companyName}</strong>
                        <span className="text-ink-muted text-xs">{drive.role}</span>
                        {drive.location && (
                          <div className="text-[11px] text-ink-subtle flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            <span>{drive.location}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="rounded-md bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-muted border border-line">
                          {drive.driveType === 'ON_CAMPUS' ? 'On-Campus' : 'Off-Campus'}
                        </span>
                        <div className="mt-1 font-bold text-positive-ink text-xs">
                          {drive.ctcLpa ? `₹${drive.ctcLpa} LPA` : 'Undisclosed'}
                        </div>
                      </td>

                      <td className="py-3 px-3 space-y-0.5 text-[11px]">
                        <div>Min CGPA: <strong className="text-ink">{drive.eligibilityCgpa || '0.0'}</strong></div>
                        <div>Max Backlogs: <strong className="text-ink">{drive.maxBacklogs ?? 0}</strong></div>
                        {drive.batchYear && (
                          <div>Batch: <strong className="text-ink">{drive.batchYear}</strong></div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[11px] space-y-0.5">
                        <div className="flex items-center gap-1 text-ink-muted">
                          <Clock className="h-3 w-3 text-ink-subtle" />
                          <span>Deadline: {new Date(drive.deadline).toLocaleDateString()}</span>
                        </div>
                        {drive.driveDate && (
                          <div className="flex items-center gap-1 text-ink-subtle">
                            <Calendar className="h-3 w-3" />
                            <span>Drive: {new Date(drive.driveDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => handleOpenApplicants(drive)}
                          className="btn btn-secondary btn-xs inline-flex items-center gap-1.5"
                        >
                          <Users className="h-3.5 w-3.5 text-accent" />
                          <span>Applicants ({drive._count?.applications ?? 0})</span>
                        </button>
                      </td>

                      <td className="py-3 px-3">
                        <Badge
                          tone={
                            drive.status === 'ACTIVE'
                              ? 'positive'
                              : drive.status === 'UPCOMING'
                              ? 'blue'
                              : drive.status === 'COMPLETED'
                              ? 'neutral'
                              : 'critical'
                          }
                        >
                          {drive.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(drive)}
                          className="btn btn-ghost btn-xs text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDrive(drive.id)}
                          className="btn btn-ghost btn-xs text-critical-ink hover:bg-critical-soft"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CANDIDATE HIRING PIPELINE */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="Search candidate name, roll, company..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="input input-sm pl-8 w-full"
                />
              </div>

              <select
                value={candidateFilterDrive}
                onChange={(e) => setCandidateFilterDrive(e.target.value)}
                className="input input-sm"
              >
                <option value="ALL">All Companies</option>
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.companyName} ({d.role})
                  </option>
                ))}
              </select>

              <select
                value={candidateFilterStatus}
                onChange={(e) => setCandidateFilterStatus(e.target.value)}
                className="input input-sm"
              >
                <option value="ALL">All Stages</option>
                <option value="APPLIED">APPLIED</option>
                <option value="SHORTLISTED">SHORTLISTED</option>
                <option value="INTERVIEWED">INTERVIEWED</option>
                <option value="SELECTED">SELECTED (Offer)</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <span className="text-[11px] text-ink-muted">
              Showing {filteredCandidates.length} candidate applications
            </span>
          </div>

          {filteredCandidates.length === 0 ? (
            <EmptyState
              title="No candidates found"
              description="No candidates match your filters or no applications have been submitted."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[10px] bg-canvas/40">
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-3 font-semibold">Drive & Role</th>
                    <th className="py-3 px-3 font-semibold">Academic Merit</th>
                    <th className="py-3 px-3 font-semibold">Current Round</th>
                    <th className="py-3 px-3 font-semibold">Online Proctor Status</th>
                    <th className="py-3 px-3 font-semibold">Stage Decision</th>
                    <th className="py-3 px-4 text-right font-semibold">Advance Round</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredCandidates.map((c) => {
                    const prof = c.student?.placementProfile;
                    return (
                      <tr key={c.id} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <strong className="text-ink font-semibold block text-sm">
                              {prof?.fullName || c.student?.fullName || c.student?.username}
                            </strong>
                            {prof?.isVerified && (
                              <ShieldCheck className="h-3.5 w-3.5 text-positive shrink-0" title="Verified POD Dossier" />
                            )}
                          </div>
                          <span className="text-[11px] text-ink-subtle">
                            {prof?.rollNumber || c.student?.email}
                          </span>
                          {prof?.resumeUrl && (
                            <a
                              href={prof.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-accent flex items-center gap-1 hover:underline mt-0.5"
                            >
                              <span>View Resume</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <strong className="text-ink block">{c.drive?.companyName}</strong>
                          <span className="text-ink-muted text-[11px]">{c.drive?.role}</span>
                          <span className="text-positive-ink block text-[10px] font-bold">
                            ₹{c.drive?.ctcLpa} LPA
                          </span>
                        </td>

                        <td className="py-3 px-3 space-y-0.5 text-[11px]">
                          <div>Branch: <strong className="text-ink">{prof?.branch || 'N/A'}</strong></div>
                          <div>CGPA: <strong className="text-positive-ink">{prof?.cgpa ?? '—'}</strong></div>
                          <div className="text-[10px] text-ink-subtle">
                            Backlogs: {prof?.activeBacklogs ?? 0}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2.5 py-1 text-xs font-semibold text-ink border border-line">
                            <Layers className="h-3 w-3 text-accent" />
                            <span>{c.currentRound || 'Resume Screening'}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              tone={
                                c.proctorStatus === 'CLEARED'
                                  ? 'positive'
                                  : c.proctorStatus === 'FLAGGED'
                                  ? 'warning'
                                  : c.proctorStatus === 'DISQUALIFIED'
                                  ? 'critical'
                                  : 'neutral'
                              }
                            >
                              {c.proctorStatus || 'NOT_STARTED'}
                            </Badge>
                            {c.assessmentScore !== undefined && c.assessmentScore !== null && (
                              <span className="text-[10px] font-bold text-ink">
                                {c.assessmentScore}%
                              </span>
                            )}
                          </div>
                          {c.proctorNotes && (
                            <p className="text-[10px] text-ink-subtle mt-0.5 truncate max-w-[140px]" title={c.proctorNotes}>
                              {c.proctorNotes}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <select
                            value={c.status}
                            onChange={(e) =>
                              handleUpdateApplicantStatus(c.id, e.target.value, c.currentRound, c.notes)
                            }
                            className="input input-xs text-[11px] bg-canvas"
                          >
                            <option value="APPLIED">APPLIED</option>
                            <option value="SHORTLISTED">SHORTLISTED</option>
                            <option value="INTERVIEWED">INTERVIEWED</option>
                            <option value="SELECTED">SELECTED (Offer)</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <select
                            value={c.currentRound || 'Resume Screening'}
                            onChange={(e) =>
                              handleUpdateApplicantStatus(c.id, c.status, e.target.value, c.notes)
                            }
                            className="input input-xs text-[11px] bg-canvas"
                          >
                            {SELECTION_ROUNDS.map((round) => (
                              <option key={round} value={round}>
                                {round}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STUDENT POD DOSSIERS */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="Search student name or roll..."
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  className="input input-sm pl-8 w-full"
                />
              </div>

              <select
                value={profileBranchFilter}
                onChange={(e) => setProfileBranchFilter(e.target.value)}
                className="input input-sm"
              >
                <option value="ALL">All Branches</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
              </select>
            </div>

            <span className="text-[11px] text-ink-muted">
              {filteredProfiles.length} student dossiers registered
            </span>
          </div>

          {filteredProfiles.length === 0 ? (
            <EmptyState
              title="No student profiles registered"
              description="Students will appear here once they complete their placement registration."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[10px] bg-canvas/40">
                    <th className="py-3 px-4 font-semibold">Student Name & Roll</th>
                    <th className="py-3 px-3 font-semibold">Academic Record</th>
                    <th className="py-3 px-3 font-semibold">Skills & Tech Stack</th>
                    <th className="py-3 px-3 font-semibold">External Links</th>
                    <th className="py-3 px-3 font-semibold">Verification Status</th>
                    <th className="py-3 px-4 text-right font-semibold">T&P Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-ink font-semibold block text-sm">
                          {p.fullName || p.user?.fullName || p.user?.username}
                        </strong>
                        <span className="text-[11px] text-ink-subtle">
                          Roll: {p.rollNumber || 'N/A'} • {p.user?.email}
                        </span>
                        {p.phone && (
                          <div className="text-[10px] text-ink-muted mt-0.5">
                            Phone: {p.phone}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 space-y-0.5 text-[11px]">
                        <div>Branch: <strong className="text-ink">{p.branch || 'N/A'}</strong></div>
                        <div>CGPA: <strong className="text-positive-ink font-bold">{p.cgpa}</strong></div>
                        <div className="text-[10px] text-ink-subtle">
                          10th: {p.tenthPercentage ?? '—'}% • 12th: {p.twelfthPercentage ?? '—'}% • Backlogs: {p.activeBacklogs ?? 0}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {Array.isArray(p.skills) && p.skills.length > 0 ? (
                            p.skills.slice(0, 4).map((s) => (
                              <span
                                key={s}
                                className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-muted border border-line"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-ink-subtle text-[11px]">None recorded</span>
                          )}
                          {Array.isArray(p.skills) && p.skills.length > 4 && (
                            <span className="text-[10px] text-ink-subtle">+{p.skills.length - 4} more</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 space-y-1 text-[11px]">
                        {p.resumeUrl ? (
                          <a
                            href={p.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent flex items-center gap-1 hover:underline"
                          >
                            <span>Resume PDF</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-ink-subtle">No Resume</span>
                        )}
                        {p.githubUrl && (
                          <a
                            href={p.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-muted flex items-center gap-1 hover:underline"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {p.isVerified ? (
                          <Badge tone="positive">Verified</Badge>
                        ) : (
                          <Badge tone="warning">Pending Review</Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {p.isVerified ? (
                          <button
                            type="button"
                            onClick={() => handleVerifyProfile(p.id, false)}
                            className="btn btn-ghost btn-xs text-critical-ink hover:bg-critical-soft"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleVerifyProfile(p.id, true)}
                            className="btn btn-primary btn-xs inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            <span>Verify Dossier</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT DRIVE MODAL */}
      {driveModal && (
        <Modal
          open={driveModal}
          onClose={() => setDriveModal(false)}
          title={editingDrive ? `Edit ${editingDrive.companyName} Drive` : 'New Placement Drive'}
        >
          <form onSubmit={handleSaveDrive} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company Name" required>
                <input
                  type="text"
                  required
                  value={formDrive.companyName}
                  onChange={(e) => setFormDrive({ ...formDrive, companyName: e.target.value })}
                  placeholder="e.g. Google, Microsoft, Amazon"
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Job Role / Designation" required>
                <input
                  type="text"
                  required
                  value={formDrive.role}
                  onChange={(e) => setFormDrive({ ...formDrive, role: e.target.value })}
                  placeholder="e.g. Software Engineer Intern"
                  className="input input-sm w-full"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Drive Type">
                <select
                  value={formDrive.driveType}
                  onChange={(e) => setFormDrive({ ...formDrive, driveType: e.target.value })}
                  className="input input-sm w-full"
                >
                  <option value="ON_CAMPUS">ON_CAMPUS</option>
                  <option value="OFF_CAMPUS">OFF_CAMPUS</option>
                </select>
              </Field>

              <Field label="Drive Status">
                <select
                  value={formDrive.status}
                  onChange={(e) => setFormDrive({ ...formDrive, status: e.target.value })}
                  className="input input-sm w-full"
                >
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </Field>

              <Field label="Package CTC (LPA)">
                <input
                  type="number"
                  step="0.1"
                  value={formDrive.ctcLpa}
                  onChange={(e) => setFormDrive({ ...formDrive, ctcLpa: e.target.value })}
                  placeholder="e.g. 18.5"
                  className="input input-sm w-full"
                />
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Field label="Min CGPA" required>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formDrive.eligibilityCgpa}
                  onChange={(e) => setFormDrive({ ...formDrive, eligibilityCgpa: e.target.value })}
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Max Backlogs">
                <input
                  type="number"
                  value={formDrive.maxBacklogs}
                  onChange={(e) => setFormDrive({ ...formDrive, maxBacklogs: e.target.value })}
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Min 10th %">
                <input
                  type="number"
                  value={formDrive.minTenthPercent}
                  onChange={(e) => setFormDrive({ ...formDrive, minTenthPercent: e.target.value })}
                  placeholder="70"
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Min 12th %">
                <input
                  type="number"
                  value={formDrive.minTwelfthPercent}
                  onChange={(e) => setFormDrive({ ...formDrive, minTwelfthPercent: e.target.value })}
                  placeholder="70"
                  className="input input-sm w-full"
                />
              </Field>
            </div>

            <Field label="Eligible Branches (comma-separated)">
              <input
                type="text"
                value={formDrive.eligibleBranches}
                onChange={(e) => setFormDrive({ ...formDrive, eligibleBranches: e.target.value })}
                placeholder="Computer Science, Information Technology, Electronics"
                className="input input-sm w-full text-xs"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <input
                  type="text"
                  value={formDrive.location}
                  onChange={(e) => setFormDrive({ ...formDrive, location: e.target.value })}
                  placeholder="e.g. Bangalore / Hybrid"
                  className="input input-sm w-full"
                />
              </Field>

              <Field label="Application Deadline" required>
                <input
                  type="date"
                  required
                  value={formDrive.deadline}
                  onChange={(e) => setFormDrive({ ...formDrive, deadline: e.target.value })}
                  className="input input-sm w-full"
                />
              </Field>
            </div>

            <Field label="Job Description & Criteria Details">
              <textarea
                rows={3}
                value={formDrive.description}
                onChange={(e) => setFormDrive({ ...formDrive, description: e.target.value })}
                placeholder="Role requirements, technical skills expected, selection stages..."
                className="input input-sm w-full text-xs"
              />
            </Field>

            <div className="pt-4 border-t border-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDriveModal(false)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDrive}
                className="btn btn-sm btn-primary"
              >
                {savingDrive ? 'Saving...' : editingDrive ? 'Update Drive' : 'Publish Drive'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* APPLICANTS REVIEW MODAL */}
      {viewingApplicantsDrive && (
        <Modal
          open={Boolean(viewingApplicantsDrive)}
          onClose={() => setViewingApplicantsDrive(null)}
          title={`Drive Applicants: ${viewingApplicantsDrive.companyName} (${viewingApplicantsDrive.role})`}
        >
          <div className="space-y-4">
            {loadingApplicants ? (
              <Spinner label="Loading applicants..." />
            ) : applicants.length === 0 ? (
              <EmptyState
                title="No applicants yet"
                description="No registered students have submitted applications for this recruitment drive yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-line text-ink-subtle uppercase tracking-wider text-[10px]">
                      <th className="pb-2.5 pr-3 font-semibold">Student Name & Roll</th>
                      <th className="pb-2.5 pr-3 font-semibold">Academic Record</th>
                      <th className="pb-2.5 pr-3 font-semibold">Current Round</th>
                      <th className="pb-2.5 pr-3 font-semibold">Proctor Status</th>
                      <th className="pb-2.5 pr-3 font-semibold">Status</th>
                      <th className="pb-2.5 pr-3 font-semibold">Stage Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {applicants.map((app) => (
                      <tr key={app.id} className="hover:bg-canvas/50">
                        <td className="py-3 pr-3">
                          <strong className="text-ink block font-semibold">
                            {app.student?.placementProfile?.fullName || app.student?.fullName || app.student?.username}
                          </strong>
                          <span className="text-[11px] text-ink-subtle">
                            {app.student?.placementProfile?.rollNumber || app.student?.email}
                          </span>
                        </td>
                        <td className="py-3 pr-3 space-y-0.5">
                          <div className="text-ink font-medium">{app.student?.placementProfile?.branch || 'N/A'}</div>
                          <div className="text-positive-ink font-bold">
                            CGPA: {app.student?.placementProfile?.cgpa ?? '—'}
                          </div>
                          <div className="text-ink-subtle text-[10px]">
                            Backlogs: {app.student?.placementProfile?.activeBacklogs ?? 0}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="font-semibold text-ink">
                            {app.currentRound || 'Resume Screening'}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge
                            tone={
                              app.proctorStatus === 'CLEARED'
                                ? 'positive'
                                : app.proctorStatus === 'FLAGGED'
                                ? 'warning'
                                : app.proctorStatus === 'DISQUALIFIED'
                                ? 'critical'
                                : 'neutral'
                            }
                          >
                            {app.proctorStatus || 'NOT_STARTED'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge
                            tone={
                              app.status === 'SELECTED'
                                ? 'positive'
                                : app.status === 'SHORTLISTED'
                                ? 'blue'
                                : app.status === 'REJECTED'
                                ? 'critical'
                                : 'neutral'
                            }
                          >
                            {app.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <select
                            value={app.status}
                            onChange={(e) =>
                              handleUpdateApplicantStatus(app.id, e.target.value, app.currentRound, app.notes)
                            }
                            className="input input-xs text-[11px] bg-canvas"
                          >
                            <option value="APPLIED">APPLIED</option>
                            <option value="SHORTLISTED">SHORTLISTED</option>
                            <option value="INTERVIEWED">INTERVIEWED</option>
                            <option value="SELECTED">SELECTED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setViewingApplicantsDrive(null)}
                className="btn btn-sm btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AdminPlacementPage;
