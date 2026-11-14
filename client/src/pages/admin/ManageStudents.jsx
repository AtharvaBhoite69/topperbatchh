import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { EmptyState, LoadingSkeleton, ComicBadge } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { Users, Search, Shield, Ban, CheckCircle, Eye, Mail, Send, Clock, Check, X, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageStudents = ({ initialTab = 'roster' }) => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'requests' || initialTab === 'requests' ? 'requests' : 'roster'
  );
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Department / Semester requests state
  const [deptRequests, setDeptRequests] = useState([]);
  const [deptFilter, setDeptFilter] = useState('pending'); // 'pending' | 'all' | 'approved' | 'rejected'
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  // Rejection modal
  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Personal Email modal state
  const [emailTarget, setEmailTarget] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSendPersonalEmail = async (e) => {
    e.preventDefault();
    if (!emailTarget || !emailSubject.trim() || !emailMessage.trim()) return;

    setSendingEmail(true);
    try {
      const res = await adminApi.sendEmailBroadcast({
        audience: 'single',
        recipientId: emailTarget.id,
        subject: emailSubject.trim(),
        title: emailSubject.trim(),
        message: emailMessage.trim(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || `Personal email sent to ${emailTarget.full_name}!`);
        setEmailTarget(null);
        setEmailSubject('');
        setEmailMessage('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send personal email.');
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchDeptRequests();
  }, [statusFilter, search, page]);

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchDeptRequests();
    }
  }, [activeTab, deptFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getStudents({
        status: statusFilter,
        search,
        page,
        limit: 15,
      });

      if (res.data?.success) {
        setStudents(res.data.students || []);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch (err) {
      toast.error('Failed to load student roster.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeptRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await adminApi.getDepartmentRequests({ status: deptFilter });
      if (res.data?.success) {
        setDeptRequests(res.data.requests || []);
        setPendingRequestsCount(res.data.pending_count || 0);
      }
    } catch (err) {
      console.error('Failed to load dept requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveDeptRequest = async (requestId) => {
    setProcessingRequestId(requestId);
    try {
      const res = await adminApi.approveDepartmentRequest(requestId);
      if (res.data?.success) {
        toast.success(res.data.message || 'Request approved! Student department & semester updated.');
        fetchDeptRequests();
        fetchStudents();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleOpenRejectModal = (req) => {
    setRejectModalReq(req);
    setRejectReason('');
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModalReq) return;

    setProcessingRequestId(rejectModalReq.id);
    try {
      const res = await adminApi.rejectDepartmentRequest(rejectModalReq.id, {
        admin_notes: rejectReason.trim() || undefined,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Change request rejected.');
        setRejectModalReq(null);
        setRejectReason('');
        fetchDeptRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    const confirm = window.confirm(`Are you sure you want to change student status to ${newStatus.toUpperCase()}?`);
    if (!confirm) return;

    try {
      await adminApi.updateStudentStatus(id, { status: newStatus });
      toast.success(`Student status updated to ${newStatus}.`);
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
    } catch (err) {
      toast.error('Could not update status.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              STUDENT ROSTER & ACADEMIC PERMISSIONS
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Manage approved student accounts, oversee department access, and approve branch/semester transfer requests.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('roster')}
            className={`comic-btn text-xs px-3.5 py-2 flex items-center gap-1.5 ${
              activeTab === 'roster' ? 'comic-btn-yellow font-bold' : 'comic-btn-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>STUDENT ROSTER</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`comic-btn text-xs px-3.5 py-2 flex items-center gap-1.5 relative ${
              activeTab === 'requests' ? 'comic-btn-yellow font-bold' : 'comic-btn-white'
            }`}
          >
            <Clock className="w-4 h-4 text-punch-red" />
            <span>DEPT REQUESTS</span>
            {pendingRequestsCount > 0 && (
              <span className="bg-punch-red text-cream font-comic text-[10px] px-1.5 py-0.2 rounded-full border border-ink animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'roster' ? (
        <>
          {/* Filter and Search Bar */}
          <div className="comic-box bg-cream p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink pointer-events-none" />
              <input
                type="text"
                placeholder="Search student by name, email or department..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="comic-input text-xs pl-9 pr-3 py-2 bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              {['all', 'approved', 'suspended', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`comic-badge text-xs px-3 py-1.5 uppercase cursor-pointer ${
                    statusFilter === st
                      ? 'bg-comic-yellow text-ink font-bold shadow-[2px_2px_0px_#171510]'
                      : 'bg-white text-ink/70'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingSkeleton count={4} />
          ) : students.length === 0 ? (
            <EmptyState icon="👥" title="NO STUDENTS FOUND" description="No student records matching your query." />
          ) : (
            <div className="comic-box bg-white overflow-hidden">
              <div className="divide-y-2 divide-ink/10">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-cream/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-comic-yellow text-ink font-heading font-black text-sm flex items-center justify-center border-2 border-ink">
                        {student.full_name?.slice(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-heading text-base uppercase text-ink">
                            {student.full_name}
                          </h4>
                          <span
                            className={`font-comic text-[9px] px-1.5 py-0.2 rounded border border-ink ${
                              student.status === 'approved'
                                ? 'bg-victory-green text-cream'
                                : student.status === 'suspended'
                                ? 'bg-punch-red text-cream'
                                : 'bg-secondary-grey text-ink'
                            }`}
                          >
                            {student.status.toUpperCase()}
                          </span>
                          <span className="font-comic text-[9px] px-1.5 py-0.2 rounded border border-ink bg-comic-yellow text-ink">
                            {student.department || 'Computer Science'} • Sem {student.semester || 1}
                          </span>
                          <span
                            className={`font-comic text-[9px] px-1.5 py-0.2 rounded border border-ink ${
                              (student.screenshot_attempts || 0) > 0
                                ? 'bg-punch-red text-cream'
                                : 'bg-cream text-ink/70'
                            }`}
                            title="Detected screenshot attempts"
                          >
                            SCREENSHOTS: {student.screenshot_attempts || 0}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-olive-dark">
                          {student.email} • {student.total_points || 0} pts
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <ComicButton
                        variant="yellow"
                        size="sm"
                        icon={<Mail className="w-3.5 h-3.5" />}
                        onClick={() => setEmailTarget(student)}
                      >
                        EMAIL
                      </ComicButton>

                      <Link to={`/admin/students/${student.id}`}>
                        <ComicButton variant="white" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                          DETAILS / EDIT
                        </ComicButton>
                      </Link>

                      <button
                        onClick={() => handleToggleStatus(student.id, student.status)}
                        className={`comic-btn text-xs px-2.5 py-1 ${
                          student.status === 'suspended' ? 'comic-btn-green' : 'comic-btn-red'
                        }`}
                      >
                        {student.status === 'suspended' ? 'REACTIVATE' : 'SUSPEND'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-2">
              <ComicButton
                variant="white"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                PREV
              </ComicButton>
              <span className="font-heading text-xs text-ink px-3">
                PAGE {page} OF {totalPages}
              </span>
              <ComicButton
                variant="white"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                NEXT
              </ComicButton>
            </div>
          )}
        </>
      ) : (
        /* Academic Department & Semester Requests Tab */
        <div className="space-y-4">
          {/* Requests Filter Pills */}
          <div className="comic-box bg-cream p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-comic text-xs uppercase text-ink">FILTER STATUS:</span>
              {['pending', 'all', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setDeptFilter(st)}
                  className={`comic-badge text-xs px-3 py-1 uppercase cursor-pointer ${
                    deptFilter === st
                      ? 'bg-comic-yellow text-ink font-bold shadow-[2px_2px_0px_#171510]'
                      : 'bg-white text-ink/70'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <ComicButton
              variant="white"
              size="sm"
              onClick={fetchDeptRequests}
              loading={loadingRequests}
            >
              REFRESH
            </ComicButton>
          </div>

          {/* Requests Table */}
          {loadingRequests ? (
            <LoadingSkeleton count={3} />
          ) : deptRequests.length === 0 ? (
            <EmptyState
              icon="📋"
              title="NO CHANGE REQUESTS"
              description={`There are currently no department or semester change requests with status "${deptFilter}".`}
            />
          ) : (
            <div className="comic-box bg-white overflow-hidden">
              <div className="divide-y-2 divide-ink/10">
                {deptRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-cream/30 transition-colors"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-base uppercase text-ink">
                          {req.student_name || 'Student'}
                        </span>
                        <span className="font-mono text-xs text-olive-dark">
                          ({req.student_email})
                        </span>
                        <span
                          className={`font-comic text-[9px] px-1.5 py-0.2 rounded border border-ink ${
                            req.status === 'pending'
                              ? 'bg-comic-yellow text-ink'
                              : req.status === 'approved'
                              ? 'bg-victory-green text-cream'
                              : 'bg-punch-red text-cream'
                          }`}
                        >
                          {req.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Department/Semester Transition */}
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="bg-cream border border-ink px-2 py-0.5 rounded text-ink/80">
                          {req.current_department || 'Computer Science'} • Sem {req.current_semester || 1}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-punch-red flex-shrink-0" />
                        <span className="bg-comic-yellow font-bold border border-ink px-2 py-0.5 rounded text-ink shadow-[1px_1px_0px_#171510]">
                          {req.requested_department} • Sem {req.requested_semester}
                        </span>
                      </div>

                      {req.reason && (
                        <p className="font-sans text-xs text-ink/85 italic bg-cream/70 p-2 rounded border border-ink/15">
                          "{req.reason}"
                        </p>
                      )}

                      <div className="font-mono text-[10px] text-olive-dark flex items-center gap-2">
                        <span>Requested: {new Date(req.created_at).toLocaleString()}</span>
                        {req.resolved_at && (
                          <span>• Resolved: {new Date(req.resolved_at).toLocaleString()}</span>
                        )}
                        {req.admin_notes && (
                          <span className="text-punch-red font-bold">• Note: {req.admin_notes}</span>
                        )}
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          onClick={() => handleApproveDeptRequest(req.id)}
                          disabled={processingRequestId === req.id}
                          className="comic-btn comic-btn-green text-xs px-3 py-1.5 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>APPROVE</span>
                        </button>

                        <button
                          onClick={() => handleOpenRejectModal(req)}
                          disabled={processingRequestId === req.id}
                          className="comic-btn comic-btn-red text-xs px-3 py-1.5 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>REJECT</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Request Reason Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-md w-full bg-cream p-6 animate-in fade-in">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-punch-red mb-2">
              DECLINE TRANSFER REQUEST
            </h3>
            <p className="font-sans text-xs text-ink/80 mb-4">
              Declining request for <strong>{rejectModalReq.student_name}</strong> to transfer to {rejectModalReq.requested_department} Sem {rejectModalReq.requested_semester}.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <ComicInput
                label="Reason / Admin Note to Student (Optional)"
                placeholder="e.g. Please provide your enrollment slip or contact admin."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalReq(null)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={processingRequestId === rejectModalReq.id}
                  className="comic-btn comic-btn-red text-xs px-4 py-2"
                >
                  CONFIRM REJECTION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Personal Email Modal */}
      {emailTarget && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-lg w-full bg-cream p-6 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-5 h-5 text-punch-red" />
              <h3 className="font-heading text-2xl uppercase tracking-wide text-ink">
                PERSONAL EMAIL TO STUDENT
              </h3>
            </div>
            <p className="font-mono text-xs text-olive-dark mb-4">
              To: <strong className="text-ink">{emailTarget.full_name}</strong> ({emailTarget.email})
            </p>

            <form onSubmit={handleSendPersonalEmail} className="space-y-4">
              <ComicInput
                label="Email Subject"
                placeholder="e.g. Important update regarding your progress"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                required
              />

              <ComicInput
                label="Personal Message"
                textarea={true}
                rows={5}
                placeholder={`Write a personal message for ${emailTarget.full_name}...`}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailTarget(null);
                    setEmailSubject('');
                    setEmailMessage('');
                  }}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton
                  type="submit"
                  variant="yellow"
                  size="sm"
                  loading={sendingEmail}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  SEND PERSONAL EMAIL
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStudents;

