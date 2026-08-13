import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { io } from 'socket.io-client';

// Dynamic Color Palette for Light/Dark Themes
const themeColors = {
  light: {
    background: '#f6f8fa',
    surface: '#ffffff',
    primary: '#6366f1',
    primaryHover: '#4f46e5',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    cardShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    inputBg: '#ffffff'
  },
  dark: {
    background: '#0d1117',
    surface: '#161b22',
    primary: '#6366f1',
    primaryHover: '#818cf8',
    text: '#f3f4f6',
    textSecondary: '#8b949e',
    border: '#30363d',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    cardShadow: '0 4px 10px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)',
    inputBg: '#0d1117'
  }
};

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('meditrack_theme') || 'light');
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('loading');
  const [authError, setAuthError] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  
  // Navigation tabs depend on roles
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Patient states
  const [doctorsList, setDoctorsList] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [medications, setMedications] = useState([]);
  
  // Chat states
  const [chatPartner, setChatPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Doctor states
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null);
  const [showPatientHistoryModal, setShowPatientHistoryModal] = useState(false);
  const [prescriptionNoteInput, setPrescriptionNoteInput] = useState('');
  const [prescriptionApptId, setPrescriptionApptId] = useState(null);

  // Admin states
  const [analytics, setAnalytics] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteSpec, setPromoteSpec] = useState('');
  const [promoteBio, setPromoteBio] = useState('');
  const [promoteEduc, setPromoteEduc] = useState('');
  const [adminApptFilter, setAdminApptFilter] = useState('all');
  const [currentDoctorProfile, setCurrentDoctorProfile] = useState(null);

  const colors = themeColors[theme];

  // Apply general styles to html body
  useEffect(() => {
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
    localStorage.setItem('meditrack_theme', theme);
  }, [theme, colors]);

  // Session Initiation (check JWT and load profile)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('meditrack_token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('meditrack_token');
    if (token) {
      loadUserProfile();
    } else {
      setCurrentPage('login');
    }
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await api.auth.getProfile();
      setUser(profile);
      if (profile.role === 'admin') {
        setCurrentPage('admin-dashboard');
        setActiveTab('analytics');
      } else if (profile.role === 'doctor') {
        setCurrentPage('doctor-dashboard');
        setActiveTab('today-appointments');
        try {
          const docs = await api.doctors.list();
          const docProfile = docs.find(d => d.user._id === profile._id);
          setCurrentDoctorProfile(docProfile);
        } catch (e) {
          console.error('Failed to load doctor profile details:', e);
        }
      } else {
        setCurrentPage('patient-dashboard');
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error(err);
      handleLogout();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('meditrack_token');
    setUser(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setCurrentPage('login');
    setAuthError('');
    setAuthMsg('');
  };

  // Socket.io Real-time Setup
  useEffect(() => {
    if (!user) return;

    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('register', user._id);

    socketRef.current.on('receive_message', (msg) => {
      // If we are currently chatting with the sender, append message to conversation
      if (chatPartner && (msg.sender === chatPartner._id || msg.receiver === chatPartner._id)) {
        setMessages((prev) => [...prev, msg]);
      }
      // Also refresh chat headers/list
      triggerChatRefresh();
    });

    socketRef.current.on('message_sent', (msg) => {
      if (chatPartner && (msg.sender === chatPartner._id || msg.receiver === chatPartner._id)) {
        setMessages((prev) => [...prev, msg]);
      }
      triggerChatRefresh();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, chatPartner]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load Data based on roles and tabs
  useEffect(() => {
    if (!user) return;

    if (user.role === 'patient') {
      if (activeTab === 'dashboard') {
        fetchDashboardData();
      } else if (activeTab === 'book-appointment') {
        fetchSpecializationsAndDoctors();
      } else if (activeTab === 'my-appointments') {
        fetchPatientAppointments();
      } else if (activeTab === 'health-tracker') {
        fetchHealthLogs();
      } else if (activeTab === 'medical-records') {
        fetchMedicalRecords();
      } else if (activeTab === 'medications') {
        fetchMedications();
      } else if (activeTab === 'chat') {
        fetchChatPartnersForPatient();
      }
    } else if (user.role === 'doctor') {
      if (activeTab === 'today-appointments' || activeTab === 'schedule') {
        fetchDoctorAppointments();
      } else if (activeTab === 'chat') {
        fetchChatPartnersForDoctor();
      }
    } else if (user.role === 'admin') {
      if (activeTab === 'analytics') {
        fetchAdminAnalytics();
      } else if (activeTab === 'doctors') {
        fetchAdminDoctorsPage();
      } else if (activeTab === 'users') {
        fetchAdminUsers();
      } else if (activeTab === 'appointments') {
        fetchAdminAppointments();
      }
    }
  }, [user, activeTab]);

  // ==========================================
  // PATIENT DATA FETCHING
  // ==========================================
  const fetchDashboardData = async () => {
    try {
      const appts = await api.appointments.list();
      setAppointments(appts);
      const logs = await api.health.listLogs();
      setHealthLogs(logs);
      const recs = await api.records.list();
      setMedicalRecords(recs);
      const meds = await api.medications.list();
      setMedications(meds);
      await fetchSpecializationsAndDoctors();
    } catch (err) {
      console.error('Error fetching patient dashboard data:', err);
    }
  };

  const fetchSpecializationsAndDoctors = async () => {
    try {
      const specs = await api.doctors.listSpecializations();
      setSpecializations(specs);
      const docs = await api.doctors.list();
      setDoctorsList(docs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPatientAppointments = async () => {
    try {
      const appts = await api.appointments.list();
      setAppointments(appts);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHealthLogs = async () => {
    try {
      const logs = await api.health.listLogs();
      setHealthLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const recs = await api.records.list();
      setMedicalRecords(recs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMedications = async () => {
    try {
      const meds = await api.medications.list();
      setMedications(meds);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChatPartnersForPatient = async () => {
    try {
      // Find all doctors who are registered
      const docs = await api.doctors.list();
      const chatUsers = docs.map(d => ({
        _id: d.user._id,
        email: d.user.email,
        name: d.user.profile.name,
        specialization: d.specialization,
        role: 'doctor'
      }));
      setChatList(chatUsers);
      if (chatUsers.length > 0 && !chatPartner) {
        handleSelectChatPartner(chatUsers[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerChatRefresh = async () => {
    if (chatPartner) {
      try {
        const history = await api.chat.getHistory(chatPartner._id);
        setMessages(history);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // ==========================================
  // DOCTOR DATA FETCHING
  // ==========================================
  const fetchDoctorAppointments = async () => {
    try {
      const appts = await api.appointments.list();
      setAppointments(appts);
      
      // Extract unique patients for history lookup dropdown
      const uniquePatients = [];
      const map = new Map();
      for (const appt of appts) {
        if (appt.patient && !map.has(appt.patient._id)) {
          map.set(appt.patient._id, true);
          uniquePatients.push(appt.patient);
        }
      }
      setDoctorPatients(uniquePatients);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChatPartnersForDoctor = async () => {
    try {
      // Get all patients who booked appointments with this doctor
      const appts = await api.appointments.list();
      const uniquePatients = [];
      const map = new Map();
      for (const appt of appts) {
        if (appt.patient && !map.has(appt.patient._id)) {
          map.set(appt.patient._id, true);
          uniquePatients.push({
            _id: appt.patient._id,
            email: appt.patient.email,
            name: appt.patient.profile.name,
            role: 'patient'
          });
        }
      }
      setChatList(uniquePatients);
      if (uniquePatients.length > 0 && !chatPartner) {
        handleSelectChatPartner(uniquePatients[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // ADMIN DATA FETCHING
  // ==========================================
  const fetchAdminAnalytics = async () => {
    try {
      const stats = await api.admin.getAnalytics();
      setAnalytics(stats);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminDoctorsPage = async () => {
    try {
      const docs = await api.doctors.list();
      setDoctorsList(docs);
      const allUsers = await api.admin.listUsers();
      setAdminUsers(allUsers);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const allUsers = await api.admin.listUsers();
      setAdminUsers(allUsers);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminAppointments = async () => {
    try {
      const appts = await api.appointments.list();
      setAppointments(appts);
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // ACTIONS HANDLERS
  // ==========================================
  const handleSelectChatPartner = async (partner) => {
    setChatPartner(partner);
    try {
      const history = await api.chat.getHistory(partner._id);
      setMessages(history);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = () => {
    if (!newMessageText.trim() || !chatPartner || !socketRef.current) return;
    
    socketRef.current.emit('send_message', {
      receiverId: chatPartner._id,
      content: newMessageText.trim()
    });
    setNewMessageText('');
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMsg('');
    const form = e.target;
    const name = form.name.value;
    const email = form.email.value;
    const password = form.password.value;

    try {
      const res = await api.auth.register(email, password, name);
      localStorage.setItem('meditrack_token', res.token);
      setUser(res.user);
      setCurrentPage('patient-dashboard');
      setActiveTab('dashboard');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLoginPatient = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMsg('');
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;

    try {
      const res = await api.auth.login(email, password);
      localStorage.setItem('meditrack_token', res.token);
      setUser(res.user);
      if (res.user.role === 'admin') {
        setCurrentPage('admin-dashboard');
        setActiveTab('analytics');
      } else {
        setCurrentPage('patient-dashboard');
        setActiveTab('dashboard');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLoginDoctor = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMsg('');
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;

    try {
      const res = await api.auth.doctorLogin(email, password);
      localStorage.setItem('meditrack_token', res.token);
      setUser(res.user);
      setCurrentPage('doctor-dashboard');
      setActiveTab('today-appointments');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    const form = e.target;
    const doctorId = form.doctorId.value;
    const date = form.date.value;
    const slot = form.slot.value;

    if (!doctorId || !date || !slot) {
      alert('Please fill out all booking fields.');
      return;
    }

    try {
      await api.appointments.book(doctorId, date, slot);
      alert('Appointment successfully booked!');
      form.reset();
      setActiveTab('my-appointments');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelAppointment = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.appointments.updateStatus(apptId, 'cancelled');
      alert('Appointment cancelled.');
      if (user.role === 'patient') {
        fetchPatientAppointments();
      } else {
        fetchDoctorAppointments();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteAppointment = (apptId) => {
    setPrescriptionApptId(apptId);
    setPrescriptionNoteInput('');
  };

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    try {
      await api.appointments.addPrescription(prescriptionApptId, prescriptionNoteInput);
      alert('Appointment marked as Completed and prescription saved!');
      setPrescriptionApptId(null);
      setPrescriptionNoteInput('');
      fetchDoctorAppointments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddHealthLog = async (e) => {
    e.preventDefault();
    const form = e.target;
    const weight = form.weight.value;
    const systolic = form.systolic.value;
    const diastolic = form.diastolic.value;
    const bloodSugar = form.bloodSugar.value;
    const date = form.date.value;

    try {
      await api.health.addLog({
        weight,
        bloodPressureSystolic: systolic,
        bloodPressureDiastolic: diastolic,
        bloodSugar,
        date
      });
      alert('Health log recorded.');
      form.reset();
      fetchHealthLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUploadRecord = async (e) => {
    e.preventDefault();
    const form = e.target;
    const fileInput = form.file;
    const fileName = form.fileName.value;

    if (!fileInput.files[0]) {
      alert('Please select a PDF file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('fileName', fileName || fileInput.files[0].name);

    try {
      alert('Uploading document, please wait...');
      await api.records.upload(formData);
      alert('Medical record PDF successfully uploaded.');
      form.reset();
      fetchMedicalRecords();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRecord = async (recId) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await api.records.delete(recId);
      alert('Medical record deleted.');
      fetchMedicalRecords();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const dosage = form.dosage.value;
    const frequency = form.frequency.value;
    const startDate = form.startDate.value;
    const endDate = form.endDate.value;

    try {
      await api.medications.add({ name, dosage, frequency, startDate, endDate });
      alert('Medication schedule added!');
      form.reset();
      fetchMedications();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteMedication = async (medId) => {
    if (!window.confirm('Remove this medication?')) return;
    try {
      await api.medications.delete(medId);
      alert('Medication removed.');
      fetchMedications();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const age = form.age.value;
    const bloodGroup = form.bloodGroup.value;
    const allergies = form.allergies.value;
    const emergencyContact = form.emergencyContact.value;

    try {
      const updatedUser = await api.auth.updateProfile({
        name,
        age: age ? Number(age) : undefined,
        bloodGroup,
        allergies,
        emergencyContact
      });
      setUser(updatedUser);
      alert('Profile updated successfully.');
    } catch (err) {
      alert(err.message);
    }
  };

  // View historical logs for a patient (Doctor checkup feature)
  const handleViewPatientHistory = async (patientId, patientName) => {
    try {
      const logs = await api.health.listLogs(patientId);
      const recs = await api.records.list(patientId);
      const meds = await api.medications.list(patientId);
      
      setSelectedPatientHistory({
        name: patientName,
        logs,
        records: recs,
        medications: meds
      });
      setShowPatientHistoryModal(true);
    } catch (err) {
      alert('Error fetching patient records: ' + err.message);
    }
  };

  // Admin Actions
  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    if (!window.confirm(`Are you sure you want to change user status to ${nextStatus}?`)) return;
    try {
      await api.admin.updateUserStatus(userId, nextStatus);
      alert(`User is now ${nextStatus}.`);
      fetchAdminUsers();
      if (activeTab === 'doctors') {
        fetchAdminDoctorsPage();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePromoteToDoctor = async (e) => {
    e.preventDefault();
    if (!promoteUserId || !promoteSpec) {
      alert('Please select a user and input a specialization.');
      return;
    }
    try {
      await api.admin.promoteDoctor({
        userId: promoteUserId,
        specialization: promoteSpec,
        biography: promoteBio,
        education: promoteEduc
      });
      alert('User promoted to Doctor!');
      setPromoteUserId('');
      setPromoteSpec('');
      setPromoteBio('');
      setPromoteEduc('');
      fetchAdminDoctorsPage();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDemoteDoctor = async (doctorId) => {
    if (!window.confirm('Demote this doctor back to a patient and clear specialization details?')) return;
    try {
      await api.admin.demoteDoctor(doctorId);
      alert('Doctor demoted to Patient.');
      fetchAdminDoctorsPage();
    } catch (err) {
      alert(err.message);
    }
  };

  // ==========================================
  // RENDER DYNAMIC PAGES & COMPONENTS
  // ==========================================

  // Inline Styled Elements
  const layoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: colors.background,
    fontFamily: 'Inter, sans-serif'
  };

  const containerStyle = {
    display: 'flex',
    flex: 1,
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '0 24px 48px 24px',
    gap: '24px'
  };

  const headerStyle = {
    backgroundColor: colors.surface,
    borderBottom: `1px solid ${colors.border}`,
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  };

  const sidebarStyle = {
    width: '260px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '24px 0'
  };

  const contentAreaStyle = {
    flex: 1,
    padding: '24px 0',
    minWidth: 0 // avoids layout breaks on charts
  };

  const sidebarButtonStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: '8px',
    backgroundColor: isActive ? `${colors.primary}15` : 'transparent',
    color: isActive ? colors.primary : colors.textSecondary,
    border: 'none',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '500',
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'Outfit, sans-serif',
    transition: 'all 0.2s ease'
  });

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    padding: '24px',
    boxShadow: colors.cardShadow,
    marginBottom: '24px'
  };

  const gridStyle = (cols = 3) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap: '24px',
    marginBottom: '24px'
  });

  const headingStyle = {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 600,
    fontSize: '24px',
    color: colors.text,
    marginBottom: '16px'
  };

  const subheadingStyle = {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 500,
    fontSize: '18px',
    color: colors.text,
    marginBottom: '12px'
  };

  const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px'
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.textSecondary,
    fontFamily: 'Outfit, sans-serif'
  };

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: '6px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  };

  const btnStyle = (variant = 'primary') => {
    let bg = colors.primary;
    let color = '#ffffff';
    if (variant === 'secondary') {
      bg = 'transparent';
      color = colors.primary;
    } else if (variant === 'danger') {
      bg = colors.danger;
    } else if (variant === 'success') {
      bg = colors.success;
    }

    return {
      padding: '10px 20px',
      borderRadius: '6px',
      border: variant === 'secondary' ? `1px solid ${colors.primary}` : 'none',
      backgroundColor: bg,
      color: color,
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Outfit, sans-serif',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'opacity 0.2s ease'
    };
  };

  const badgeStyle = (type) => {
    let bg = `${colors.primary}15`;
    let txt = colors.primary;
    if (type === 'completed' || type === 'active') {
      bg = `${colors.success}15`;
      txt = colors.success;
    } else if (type === 'cancelled' || type === 'suspended') {
      bg = `${colors.danger}15`;
      txt = colors.danger;
    }
    return {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 600,
      color: txt,
      backgroundColor: bg,
      textTransform: 'capitalize',
      display: 'inline-block'
    };
  };

  // Pure React Inline SVG Chart Component
  // Plots a smooth polygon & points with scale grids
  function HealthMetricChart({ title, data, field, color }) {
    // Filter non-empty entries for field
    const validData = data.filter(d => d[field] !== undefined && d[field] !== null);
    
    const w = 600;
    const h = 200;
    const pad = 40;

    if (validData.length === 0) {
      return (
        <div style={{...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px'}}>
          <p style={{color: colors.textSecondary, fontSize: '14px'}}>{title} - No logs recorded yet</p>
        </div>
      );
    }

    const values = validData.map(d => d[field]);
    const maxVal = Math.max(...values) * 1.1;
    const minVal = Math.min(...values) * 0.9;
    const valRange = maxVal - minVal || 1;

    // Convert logs into SVG coordinate coordinates
    const points = validData.map((d, i) => {
      const x = pad + (i / (validData.length - 1 || 1)) * (w - 2 * pad);
      const y = h - pad - ((d[field] - minVal) / valRange) * (h - 2 * pad);
      return { x, y, value: d[field], date: new Date(d.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) };
    });

    const pathD = points.reduce((acc, p, i) => {
      return acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y} `;
    }, '');

    const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z` : '';

    return (
      <div style={cardStyle}>
        <p style={{...subheadingStyle, marginBottom: '8px'}}>{title}</p>
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{display: 'block'}}>
            {/* Grids */}
            <line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke={colors.border} strokeDasharray="4 4" />
            <line x1={pad} y1={(h)/2} x2={w - pad} y2={(h)/2} stroke={colors.border} strokeDasharray="4 4" />
            <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={colors.border} />

            {/* Labels y-axis */}
            <text x={pad - 10} y={pad + 4} fill={colors.textSecondary} fontSize="10" textAnchor="end">{Math.round(maxVal)}</text>
            <text x={pad - 10} y={(h)/2 + 4} fill={colors.textSecondary} fontSize="10" textAnchor="end">{Math.round((maxVal+minVal)/2)}</text>
            <text x={pad - 10} y={h - pad + 4} fill={colors.textSecondary} fontSize="10" textAnchor="end">{Math.round(minVal)}</text>

            {/* Gradient Fill */}
            {areaD && (
              <path d={areaD} fill={`url(#grad-${field})`} opacity="0.15" />
            )}

            {/* Line Path */}
            {pathD && (
              <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Data Dots and Text Tooltips */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill={colors.surface} stroke={color} strokeWidth="3" />
                {/* Value display */}
                <text x={p.x} y={p.y - 10} fill={colors.text} fontSize="10" fontWeight="bold" textAnchor="middle">{p.value}</text>
                {/* Date Label on x-axis */}
                {(i === 0 || i === points.length - 1 || points.length < 8) && (
                  <text x={p.x} y={h - pad + 18} fill={colors.textSecondary} fontSize="9" textAnchor="middle">{p.date}</text>
                )}
              </g>
            ))}

            {/* Gradients */}
            <defs>
              <linearGradient id={`grad-${field}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================
  // SUB-PAGES COMPONENTS
  // ==========================================

  // AUTHENTICATION TEMPLATE
  if (currentPage === 'login' || currentPage === 'register' || currentPage === 'doctor-login') {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px'
      }}>
        <div style={{
          ...cardStyle,
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          margin: 0,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontSize: '48px' }}>🩺</span>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '28px', color: colors.text, marginTop: '12px' }}>
              MediTrack
            </h1>
            <p style={{ color: colors.textSecondary, fontSize: '14px', marginTop: '4px' }}>
              Personal Health & Appointments
            </p>
          </div>

          {authError && (
            <div style={{
              backgroundColor: `${colors.danger}15`,
              color: colors.danger,
              padding: '12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '20px',
              textAlign: 'center',
              border: `1px solid ${colors.danger}30`
            }}>
              {authError}
            </div>
          )}

          {currentPage === 'login' && (
            <form onSubmit={handleLoginPatient}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} type="email" name="email" required placeholder="name@example.com" />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" name="password" required placeholder="••••••••" />
              </div>
              <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                Sign In
              </button>

              <div style={{ textAlign: 'center', margin: '20px 0', color: colors.textSecondary, fontSize: '13px' }}>or</div>

              {/* Google OAuth Login Button */}
              <a 
                href="http://localhost:5000/api/auth/google"
                style={{
                  ...btnStyle('secondary'),
                  width: '100%',
                  textDecoration: 'none',
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  backgroundColor: colors.surface
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8c-.2 1-.8 1.9-1.6 2.5v2.1h2.6c1.5-1.4 2.4-3.5 2.4-6.2z"/>
                  <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.6-2.1c-.7.5-1.7.8-2.9.8-2.3 0-4.2-1.5-4.9-3.6H1.9v2.2C3.4 16.1 6 18 9 18z"/>
                  <path fill="#FBBC05" d="M4.1 10.9c-.2-.6-.3-1.3-.3-1.9s.1-1.3.3-1.9V4.9H1.9C1.3 6.1 1 7.5 1 9s.3 2.9.9 4.1l2.2-2.2z"/>
                  <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.4 3.4 1.3l2.6-2.6C13.5 1 11.4.2 9 .2 6 .2 3.4 2.1 1.9 4.9l2.2 2.2c.7-2.1 2.6-3.5 4.9-3.5z"/>
                </svg>
                Continue with Google
              </a>

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
                <span style={{ color: colors.textSecondary }}>Don't have an account? </span>
                <span 
                  style={{ color: colors.primary, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setCurrentPage('register'); setAuthError(''); }}
                >
                  Register
                </span>
              </div>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '14px' }}>
                <span 
                  style={{ color: colors.textSecondary, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { setCurrentPage('doctor-login'); setAuthError(''); }}
                >
                  Doctor Access Portal
                </span>
              </div>
            </form>
          )}

          {currentPage === 'register' && (
            <form onSubmit={handleRegisterPatient}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} type="text" name="name" required placeholder="John Doe" />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} type="email" name="email" required placeholder="john@example.com" />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" name="password" required placeholder="••••••••" />
              </div>
              <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                Create Account
              </button>

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
                <span style={{ color: colors.textSecondary }}>Already registered? </span>
                <span 
                  style={{ color: colors.primary, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setCurrentPage('login'); setAuthError(''); }}
                >
                  Sign In
                </span>
              </div>
            </form>
          )}

          {currentPage === 'doctor-login' && (
            <form onSubmit={handleLoginDoctor}>
              <h2 style={{...subheadingStyle, textAlign: 'center', marginBottom: '20px'}}>Doctor Sign In</h2>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Clinic Email Address</label>
                <input style={inputStyle} type="email" name="email" required placeholder="doctor@meditrack.com" />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" name="password" required placeholder="••••••••" />
              </div>
              <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                Doctor Login
              </button>

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
                <span 
                  style={{ color: colors.primary, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setCurrentPage('login'); setAuthError(''); }}
                >
                  Go Back to Patient Login
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // LOADING STATE
  if (currentPage === 'loading') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', color: colors.textSecondary }}>Loading MediTrack...</p>
      </div>
    );
  }

  // CORE APPLICATION LAYOUT
  return (
    <div style={layoutStyle}>
      {/* HEADER NAVBAR */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => {
          if (user.role === 'admin') setActiveTab('analytics');
          else if (user.role === 'doctor') setActiveTab('today-appointments');
          else setActiveTab('dashboard');
        }}>
          <span style={{ fontSize: '24px' }}>🩺</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '20px', color: colors.text }}>
            MediTrack
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Theme Switcher Button */}
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{
              background: 'none',
              border: `1px solid ${colors.border}`,
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: colors.text
            }}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                {user.profile.name}
              </p>
              <span style={badgeStyle(user.role)}>
                {user.role}
              </span>
            </div>
            {/* Avatar placeholder */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              {user.profile.name[0].toUpperCase()}
            </div>
          </div>

          <button style={btnStyle('secondary')} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* BODY WORKSPACE */}
      <div style={containerStyle}>
        
        {/* SIDEBAR NAVIGATION */}
        <aside style={sidebarStyle}>
          {user.role === 'patient' && (
            <>
              <button style={sidebarButtonStyle(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>
                📊 Dashboard
              </button>
              <button style={sidebarButtonStyle(activeTab === 'book-appointment')} onClick={() => setActiveTab('book-appointment')}>
                🗓️ Book Appointment
              </button>
              <button style={sidebarButtonStyle(activeTab === 'my-appointments')} onClick={() => setActiveTab('my-appointments')}>
                📅 My Appointments
              </button>
              <button style={sidebarButtonStyle(activeTab === 'health-tracker')} onClick={() => setActiveTab('health-tracker')}>
                📈 Health Tracker
              </button>
              <button style={sidebarButtonStyle(activeTab === 'medical-records')} onClick={() => setActiveTab('medical-records')}>
                📁 Medical Records
              </button>
              <button style={sidebarButtonStyle(activeTab === 'medications')} onClick={() => setActiveTab('medications')}>
                💊 Medications
              </button>
              <button style={sidebarButtonStyle(activeTab === 'chat')} onClick={() => setActiveTab('chat')}>
                💬 Chat with Doctor
              </button>
              <button style={sidebarButtonStyle(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>
                👤 My Profile
              </button>
            </>
          )}

          {user.role === 'doctor' && (
            <>
              <button style={sidebarButtonStyle(activeTab === 'today-appointments')} onClick={() => setActiveTab('today-appointments')}>
                🏥 Today's Queue
              </button>
              <button style={sidebarButtonStyle(activeTab === 'schedule')} onClick={() => setActiveTab('schedule')}>
                📅 Complete Schedule
              </button>
              <button style={sidebarButtonStyle(activeTab === 'chat')} onClick={() => setActiveTab('chat')}>
                💬 Patient Messenger
              </button>
              <button style={sidebarButtonStyle(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>
                👤 Doctor Profile
              </button>
            </>
          )}

          {user.role === 'admin' && (
            <>
              <button style={sidebarButtonStyle(activeTab === 'analytics')} onClick={() => setActiveTab('analytics')}>
                📊 Platform Stats
              </button>
              <button style={sidebarButtonStyle(activeTab === 'doctors')} onClick={() => setActiveTab('doctors')}>
                🩺 Manage Doctors
              </button>
              <button style={sidebarButtonStyle(activeTab === 'users')} onClick={() => setActiveTab('users')}>
                👥 Moderate Users
              </button>
              <button style={sidebarButtonStyle(activeTab === 'appointments')} onClick={() => setActiveTab('appointments')}>
                🗓️ All Appointments
              </button>
            </>
          )}
        </aside>

        {/* WORKSPACE PAGES CONTENT */}
        <main style={contentAreaStyle}>
          
          {/* =======================================================
              PATIENT MODULE PAGES
              ======================================================= */}
          {user.role === 'patient' && activeTab === 'dashboard' && (
            <div>
              <h2 style={headingStyle}>Personal Health Hub - Welcome, {user.profile.name}</h2>
              
              {/* Row 1: Metrics Summary */}
              <div style={gridStyle(3)}>
                <div style={{ ...cardStyle, borderLeft: `5px solid ${colors.primary}`, cursor: 'pointer' }} onClick={() => setActiveTab('health-tracker')}>
                  <p style={labelStyle}>Weight Log</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0' }}>
                    {healthLogs.length > 0 && healthLogs[healthLogs.length - 1].weight ? `${healthLogs[healthLogs.length - 1].weight} kg` : '--'}
                  </p>
                  <span style={{ fontSize: '12px', color: colors.textSecondary }}>Last recorded • Click to track</span>
                </div>
                <div style={{ ...cardStyle, borderLeft: `5px solid ${colors.success}`, cursor: 'pointer' }} onClick={() => setActiveTab('health-tracker')}>
                  <p style={labelStyle}>Blood Pressure</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0' }}>
                    {healthLogs.length > 0 && healthLogs[healthLogs.length - 1].bloodPressureSystolic ? `${healthLogs[healthLogs.length - 1].bloodPressureSystolic}/${healthLogs[healthLogs.length - 1].bloodPressureDiastolic} mmHg` : '--'}
                  </p>
                  <span style={{ fontSize: '12px', color: colors.textSecondary }}>Last recorded • Click to track</span>
                </div>
                <div style={{ ...cardStyle, borderLeft: `5px solid ${colors.warning}`, cursor: 'pointer' }} onClick={() => setActiveTab('health-tracker')}>
                  <p style={labelStyle}>Blood Glucose</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0' }}>
                    {healthLogs.length > 0 && healthLogs[healthLogs.length - 1].bloodSugar ? `${healthLogs[healthLogs.length - 1].bloodSugar} mg/dL` : '--'}
                  </p>
                  <span style={{ fontSize: '12px', color: colors.textSecondary }}>Last recorded • Click to track</span>
                </div>
              </div>

              {/* Row 2: Appointment Management (Fix Appointment Form & History) */}
              <div style={gridStyle(2)}>
                {/* Book Appointment (Fix Appointment) */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>🗓️ Fix Consultation Appointment</h3>
                  <form onSubmit={handleBookAppointment}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Select Specialist Doctor</label>
                      <select style={inputStyle} name="doctorId" required defaultValue="">
                        <option value="" disabled>-- Choose Doctor --</option>
                        {doctorsList.map(doc => (
                          <option key={doc.user._id} value={doc.user._id}>
                            {doc.user.profile.name} ({doc.specialization} • {doc.education || 'Credentials'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={gridStyle(2)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Appointment Date</label>
                        <input style={inputStyle} type="date" name="date" required min={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Time Slot</label>
                        <select style={inputStyle} name="slot" required defaultValue="">
                          <option value="" disabled>-- Select Slot --</option>
                          <option value="09:00">09:00 AM</option>
                          <option value="10:00">10:00 AM</option>
                          <option value="11:00">11:00 AM</option>
                          <option value="14:00">02:00 PM</option>
                          <option value="15:00">03:00 PM</option>
                          <option value="16:00">04:00 PM</option>
                        </select>
                      </div>
                    </div>
                    <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                      Schedule Appointment
                    </button>
                  </form>
                </div>

                {/* Consultation History */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>📅 Consultation History & Logs</h3>
                  <div style={{ maxHeight: '230px', overflowY: 'auto' }}>
                    {appointments.length === 0 ? (
                      <p style={{ color: colors.textSecondary, fontSize: '13px' }}>No consultations booked yet.</p>
                    ) : (
                      appointments.map(appt => (
                        <div key={appt._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.border}`, fontSize: '13px' }}>
                          <div>
                            <p style={{ fontWeight: 600 }}>{appt.doctor?.profile?.name || 'Doctor'}</p>
                            <p style={{ fontSize: '11px', color: colors.textSecondary }}>{appt.date} at {appt.timeSlot}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={badgeStyle(appt.status)}>{appt.status}</span>
                            {appt.status === 'scheduled' && (
                              <button style={{ ...btnStyle('danger'), padding: '4px 8px', fontSize: '11px' }} onClick={() => handleCancelAppointment(appt._id)}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Health Tracker Logs & SVG Chart */}
              <div style={gridStyle(2)}>
                {/* Log Health Metrics */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>📈 Log Personal Health Metrics</h3>
                  <form onSubmit={handleAddHealthLog}>
                    <div style={gridStyle(2)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Weight (kg)</label>
                        <input style={inputStyle} type="number" step="0.1" name="weight" placeholder="e.g. 70" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Blood Glucose (sugar - mg/dL)</label>
                        <input style={inputStyle} type="number" name="bloodSugar" placeholder="e.g. 95" />
                      </div>
                    </div>
                    <div style={gridStyle(3)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>BP Systolic (high)</label>
                        <input style={inputStyle} type="number" name="systolic" placeholder="120" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>BP Diastolic (low)</label>
                        <input style={inputStyle} type="number" name="diastolic" placeholder="80" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Logging Date</label>
                        <input style={inputStyle} type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                    </div>
                    <button style={{ ...btnStyle(), width: '100%', marginTop: '8px' }} type="submit">
                      Record Log
                    </button>
                  </form>
                </div>

                {/* SVG Glucose Chart */}
                <HealthMetricChart title="Blood Glucose Tracker (mg/dL)" data={healthLogs} field="bloodSugar" color={colors.warning} />
              </div>

              {/* Row 4: Medical History (PDF Records) & Medications */}
              <div style={gridStyle(2)}>
                {/* Medical Records (PDF History) */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>📁 Medical History (PDF Documents)</h3>
                  <form onSubmit={handleUploadRecord} style={{ marginBottom: '16px' }}>
                    <div style={gridStyle(2)}>
                      <input style={inputStyle} type="text" name="fileName" required placeholder="Report Description (e.g. Blood Lab)" />
                      <input style={inputStyle} type="file" name="file" accept="application/pdf" required />
                    </div>
                    <button style={{ ...btnStyle(), width: '100%', marginTop: '10px' }} type="submit">
                      Upload New PDF Report
                    </button>
                  </form>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {medicalRecords.length === 0 ? (
                      <p style={{ color: colors.textSecondary, fontSize: '13px' }}>No medical documents found.</p>
                    ) : (
                      medicalRecords.map(rec => (
                        <div key={rec._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: '13px' }}>
                          <span style={{ maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {rec.fileName}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <a href={rec.fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: colors.primary, fontWeight: 'bold', fontSize: '12px' }}>Open</a>
                            <span style={{ color: colors.danger, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }} onClick={() => handleDeleteRecord(rec._id)}>Delete</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Active Medications */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>💊 Medications & Prescriptions</h3>
                  <form onSubmit={handleAddMedication} style={{ marginBottom: '16px' }}>
                    <div style={gridStyle(2)}>
                      <input style={inputStyle} type="text" name="name" required placeholder="Name (e.g. Aspirin)" />
                      <input style={inputStyle} type="text" name="dosage" required placeholder="Dosage (e.g. 100mg)" />
                    </div>
                    <div style={gridStyle(3)}>
                      <input style={inputStyle} type="text" name="frequency" required placeholder="Frequency (e.g. Daily)" />
                      <input style={inputStyle} type="date" name="startDate" required defaultValue={new Date().toISOString().split('T')[0]} />
                      <input style={inputStyle} type="date" name="endDate" required />
                    </div>
                    <button style={{ ...btnStyle(), width: '100%', marginTop: '10px' }} type="submit">
                      Add Medication Schedule
                    </button>
                  </form>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {medications.length === 0 ? (
                      <p style={{ color: colors.textSecondary, fontSize: '13px' }}>No medications listed.</p>
                    ) : (
                      medications.map(med => (
                        <div key={med._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: '13px' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>💊 {med.name}</span> ({med.dosage} • {med.frequency})
                          </div>
                          <span style={{ color: colors.danger, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }} onClick={() => handleDeleteMedication(med._id)}>Remove</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {user.role === 'patient' && activeTab === 'book-appointment' && (
            <div style={{ maxWidth: '600px' }}>
              <div style={cardStyle}>
                <h2 style={headingStyle}>Book Consultation</h2>
                <form onSubmit={handleBookAppointment}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Choose Specialist Doctor</label>
                    <select style={inputStyle} name="doctorId" required defaultValue="">
                      <option value="" disabled>-- Select Doctor --</option>
                      {doctorsList.map(doc => (
                        <option key={doc.user._id} value={doc.user._id}>
                          {doc.user.profile.name} ({doc.specialization} • {doc.education || 'Credentials'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={gridStyle(2)}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Appointment Date</label>
                      <input style={inputStyle} type="date" name="date" required min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Select Time Slot</label>
                      <select style={inputStyle} name="slot" required defaultValue="">
                        <option value="" disabled>-- Select Slot --</option>
                        <option value="09:00">09:00 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="14:00">02:00 PM</option>
                        <option value="15:00">03:00 PM</option>
                        <option value="16:00">04:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                    Confirm Consultation Booking
                  </button>
                </form>
              </div>
            </div>
          )}

          {user.role === 'patient' && activeTab === 'my-appointments' && (
            <div style={cardStyle}>
              <h2 style={headingStyle}>Consultation History</h2>
              
              {appointments.length === 0 ? (
                <p style={{ color: colors.textSecondary, fontSize: '14px' }}>No consultations booked yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Doctor</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Date & Time</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Status</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Action / Prescriptions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map(appt => (
                        <tr key={appt._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '16px 8px', fontWeight: 600 }}>{appt.doctor?.profile?.name || 'Doctor'}</td>
                          <td style={{ padding: '16px 8px' }}>{appt.date} at {appt.timeSlot}</td>
                          <td style={{ padding: '16px 8px' }}>
                            <span style={badgeStyle(appt.status)}>{appt.status}</span>
                          </td>
                          <td style={{ padding: '16px 8px' }}>
                            {appt.status === 'scheduled' && (
                              <button style={btnStyle('danger')} onClick={() => handleCancelAppointment(appt._id)}>
                                Cancel
                              </button>
                            )}
                            {appt.status === 'completed' && appt.prescriptionNotes && (
                              <div style={{
                                backgroundColor: theme === 'light' ? '#f0f4f8' : '#1e293b',
                                borderLeft: `4px solid ${colors.primary}`,
                                padding: '8px 12px',
                                borderRadius: '4px',
                                fontSize: '13px'
                              }}>
                                <strong>Prescription Pad Note:</strong>
                                <p style={{ fontStyle: 'italic', margin: '4px 0 0 0' }}>{appt.prescriptionNotes}</p>
                              </div>
                            )}
                            {appt.status === 'completed' && !appt.prescriptionNotes && (
                              <span style={{ fontStyle: 'italic', color: colors.textSecondary }}>No prescription notes written.</span>
                            )}
                            {appt.status === 'cancelled' && (
                              <span style={{ color: colors.danger, fontWeight: 500 }}>Cancelled</span>
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

          {user.role === 'patient' && activeTab === 'health-tracker' && (
            <div>
              <div style={gridStyle(2)}>
                {/* Form to add health log */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>Log Health Metric</h3>
                  <form onSubmit={handleAddHealthLog}>
                    <div style={gridStyle(2)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Weight (kg)</label>
                        <input style={inputStyle} type="number" step="0.1" name="weight" placeholder="e.g. 70" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Blood Glucose (sugar - mg/dL)</label>
                        <input style={inputStyle} type="number" name="bloodSugar" placeholder="e.g. 95" />
                      </div>
                    </div>
                    
                    <div style={gridStyle(3)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>BP Systolic (high)</label>
                        <input style={inputStyle} type="number" name="systolic" placeholder="120" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>BP Diastolic (low)</label>
                        <input style={inputStyle} type="number" name="diastolic" placeholder="80" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Logging Date</label>
                        <input style={inputStyle} type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                    </div>

                    <button style={{ ...btnStyle(), width: '100%', marginTop: '8px' }} type="submit">
                      Record Log
                    </button>
                  </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Summary list of logs */}
                  <div style={{ ...cardStyle, maxHeight: '280px', overflowY: 'auto' }}>
                    <h3 style={subheadingStyle}>Recent Logs History</h3>
                    {healthLogs.length === 0 ? (
                      <p style={{ color: colors.textSecondary, fontSize: '14px' }}>No records logged yet.</p>
                    ) : (
                      healthLogs.slice().reverse().map((log, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${colors.border}`, fontSize: '13px' }}>
                          <span style={{ fontWeight: 600 }}>{new Date(log.date).toLocaleDateString()}</span>
                          <span>
                            {log.weight ? `⚖️ ${log.weight}kg ` : ''}
                            {log.bloodPressureSystolic ? `🩺 ${log.bloodPressureSystolic}/${log.bloodPressureDiastolic}mmHg ` : ''}
                            {log.bloodSugar ? `🩸 ${log.bloodSugar}mg/dL` : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Graphical representation in Pure SVGs */}
              <div style={gridStyle(2)}>
                <HealthMetricChart title="Weight Tracker (kg)" data={healthLogs} field="weight" color={colors.primary} />
                <HealthMetricChart title="Blood Glucose Tracker (mg/dL)" data={healthLogs} field="bloodSugar" color={colors.warning} />
              </div>
            </div>
          )}

          {user.role === 'patient' && activeTab === 'medical-records' && (
            <div>
              <div style={gridStyle(2)}>
                {/* Upload record card */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>Upload Medical Report</h3>
                  <form onSubmit={handleUploadRecord}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Report Name / Description</label>
                      <input style={inputStyle} type="text" name="fileName" required placeholder="e.g. Blood Lab Report Dec 2026" />
                    </div>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Select PDF Document</label>
                      <input style={inputStyle} type="file" name="file" accept="application/pdf" required />
                    </div>
                    <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                      Upload to Server (Cloudinary)
                    </button>
                  </form>
                </div>

                {/* Listing of medical records */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>My Documents List</h3>
                  {medicalRecords.length === 0 ? (
                    <p style={{ color: colors.textSecondary, fontSize: '14px' }}>No uploaded medical files found.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {medicalRecords.map(rec => (
                        <div key={rec._id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px'
                        }}>
                          <div style={{ maxWidth: '65%' }}>
                            <p style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              📄 {rec.fileName}
                            </p>
                            <span style={{ fontSize: '11px', color: colors.textSecondary }}>Uploaded: {new Date(rec.date).toLocaleDateString()}</span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <a href={rec.fileUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnStyle('secondary'), padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>
                              Open PDF
                            </a>
                            <button style={{ ...btnStyle('danger'), padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDeleteRecord(rec._id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {user.role === 'patient' && activeTab === 'medications' && (
            <div>
              <div style={gridStyle(2)}>
                {/* Form to add medication */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>Add Medication Schedule</h3>
                  <form onSubmit={handleAddMedication}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Medication Name</label>
                      <input style={inputStyle} type="text" name="name" required placeholder="e.g. Paracetamol" />
                    </div>
                    
                    <div style={gridStyle(2)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Dosage (Strength)</label>
                        <input style={inputStyle} type="text" name="dosage" required placeholder="e.g. 500mg" />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Frequency</label>
                        <input style={inputStyle} type="text" name="frequency" required placeholder="e.g. Twice daily" />
                      </div>
                    </div>

                    <div style={gridStyle(2)}>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Start Date</label>
                        <input style={inputStyle} type="date" name="startDate" required defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>End Date</label>
                        <input style={inputStyle} type="date" name="endDate" required />
                      </div>
                    </div>

                    <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                      Add Medication Schedule
                    </button>
                  </form>
                </div>

                {/* Medication Cards List */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>Active Medications</h3>
                  {medications.length === 0 ? (
                    <p style={{ color: colors.textSecondary, fontSize: '14px' }}>No active medications entered yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {medications.map(med => (
                        <div key={med._id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px'
                        }}>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '16px', color: colors.primary }}>💊 {med.name}</p>
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>{med.dosage} — {med.frequency}</p>
                            <p style={{ fontSize: '11px', color: colors.textSecondary }}>
                              Duration: {new Date(med.startDate).toLocaleDateString()} to {new Date(med.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <button style={btnStyle('danger')} onClick={() => handleDeleteMedication(med._id)}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {user.role === 'patient' && activeTab === 'profile' && (
            <div style={{ maxWidth: '600px' }}>
              <div style={cardStyle}>
                <h2 style={headingStyle}>My Profile Details</h2>
                <form onSubmit={handleUpdateProfile}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Full Name</label>
                    <input style={inputStyle} type="text" name="name" required defaultValue={user.profile.name} />
                  </div>

                  <div style={gridStyle(2)}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Age</label>
                      <input style={inputStyle} type="number" name="age" defaultValue={user.profile.age || ''} />
                    </div>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Blood Group</label>
                      <select style={inputStyle} name="bloodGroup" defaultValue={user.profile.bloodGroup || ''}>
                        <option value="">-- Choose --</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Allergies</label>
                    <textarea 
                      style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', minHeight: '80px' }} 
                      name="allergies" 
                      placeholder="List any known allergies e.g., Penicillin, Peanuts"
                      defaultValue={user.profile.allergies || ''}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Emergency Contact Number</label>
                    <input style={inputStyle} type="text" name="emergencyContact" placeholder="+1 555-0199" defaultValue={user.profile.emergencyContact || ''} />
                  </div>

                  <button style={{ ...btnStyle(), width: '100%', marginTop: '12px' }} type="submit">
                    Save Profile Changes
                  </button>
                </form>
              </div>
            </div>
          )}


          {/* =======================================================
              DOCTOR MODULE PAGES
              ======================================================= */}
          {user.role === 'doctor' && activeTab === 'today-appointments' && (
            <div>
              <h2 style={headingStyle}>Today's Clinic Queue</h2>
              
              <div style={gridStyle(2)}>
                <div style={{ ...cardStyle, borderLeft: `5px solid ${colors.primary}` }}>
                  <p style={labelStyle}>Today's Scheduled appointments</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0' }}>
                    {appointments.filter(a => a.status === 'scheduled').length}
                  </p>
                </div>
                <div style={{ ...cardStyle, borderLeft: `5px solid ${colors.success}` }}>
                  <p style={labelStyle}>Completed consultations today</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0' }}>
                    {appointments.filter(a => a.status === 'completed').length}
                  </p>
                </div>
              </div>

              {/* Complete schedule table */}
              <div style={cardStyle}>
                <h3 style={subheadingStyle}>Scheduled Patient queue</h3>
                {appointments.length === 0 ? (
                  <p style={{ color: colors.textSecondary, fontSize: '14px' }}>No appointments scheduled for today.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                          <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Patient Name</th>
                          <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Slot</th>
                          <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Status</th>
                          <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Medical History</th>
                          <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map(appt => (
                          <tr key={appt._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td style={{ padding: '16px 8px', fontWeight: 600 }}>{appt.patient?.profile?.name || 'Patient'}</td>
                            <td style={{ padding: '16px 8px' }}>{appt.date} at {appt.timeSlot}</td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={badgeStyle(appt.status)}>{appt.status}</span>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <button style={{ ...btnStyle('secondary'), padding: '6px 12px', fontSize: '12px' }} onClick={() => handleViewPatientHistory(appt.patient._id, appt.patient.profile.name)}>
                                View Records
                              </button>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              {appt.status === 'scheduled' && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button style={btnStyle('success')} onClick={() => handleCompleteAppointment(appt._id)}>
                                    Complete / Write Notes
                                  </button>
                                  <button style={btnStyle('danger')} onClick={() => handleCancelAppointment(appt._id)}>
                                    Cancel
                                  </button>
                                </div>
                              )}
                              {appt.status === 'completed' && appt.prescriptionNotes && (
                                <span style={{ fontStyle: 'italic', fontSize: '13px', color: colors.textSecondary }}>
                                  Prescription: "{appt.prescriptionNotes}"
                                </span>
                              )}
                              {appt.status === 'cancelled' && (
                                <span style={{ color: colors.danger, fontSize: '13px' }}>Cancelled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {user.role === 'doctor' && activeTab === 'schedule' && (
            <div style={cardStyle}>
              <h2 style={headingStyle}>All Scheduled Consultation Slots</h2>
              {appointments.length === 0 ? (
                <p style={{ color: colors.textSecondary, fontSize: '14px' }}>No bookings found.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Patient Name</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Date</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Slot</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map(appt => (
                        <tr key={appt._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '16px 8px', fontWeight: 600 }}>{appt.patient?.profile?.name || 'Patient'}</td>
                          <td style={{ padding: '16px 8px' }}>{appt.date}</td>
                          <td style={{ padding: '16px 8px' }}>{appt.timeSlot}</td>
                          <td style={{ padding: '16px 8px' }}>
                            <span style={badgeStyle(appt.status)}>{appt.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {user.role === 'doctor' && activeTab === 'profile' && (
            <div style={{ maxWidth: '600px' }}>
              <div style={cardStyle}>
                <h2 style={headingStyle}>My Doctor Settings</h2>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Clinic Email</label>
                  <input style={{ ...inputStyle, opacity: 0.6 }} type="text" readOnly value={user.email} />
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Practice Name</label>
                  <input style={{ ...inputStyle, opacity: 0.6 }} type="text" readOnly value={user.profile.name} />
                </div>
                {currentDoctorProfile && (
                  <>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Specialization</label>
                      <input style={{ ...inputStyle, opacity: 0.8 }} type="text" readOnly value={currentDoctorProfile.specialization} />
                    </div>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Education / Qualifications</label>
                      <input style={{ ...inputStyle, opacity: 0.8 }} type="text" readOnly value={currentDoctorProfile.education || 'Credentials'} />
                    </div>
                  </>
                )}
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Account Role</label>
                  <span style={badgeStyle(user.role)}>{user.role}</span>
                </div>
                <p style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '20px' }}>
                  Note: Doctor specialization and schedule modifications are handled by the platform Administrator.
                </p>
              </div>
            </div>
          )}


          {/* =======================================================
              ADMIN MODULE PAGES
              ======================================================= */}
          {user.role === 'admin' && activeTab === 'analytics' && (
            <div>
              <h2 style={headingStyle}>MediTrack Platform Analytics</h2>
              {analytics ? (
                <div>
                  <div style={gridStyle(4)}>
                    <div style={cardStyle}>
                      <p style={labelStyle}>Total Users</p>
                      <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '8px 0' }}>{analytics.totalUsers}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={labelStyle}>Total Doctors</p>
                      <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '8px 0' }}>{analytics.totalDoctors}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={labelStyle}>Total Patients</p>
                      <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '8px 0' }}>{analytics.totalPatients}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={labelStyle}>Total Consultations</p>
                      <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '8px 0' }}>{analytics.totalAppointments}</p>
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <h3 style={subheadingStyle}>Consultation Ratios</h3>
                    <div style={gridStyle(3)}>
                      <div>
                        <p style={labelStyle}>Scheduled Ratio</p>
                        <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{analytics.scheduledAppointments}</p>
                      </div>
                      <div>
                        <p style={labelStyle}>Completed Ratio</p>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: colors.success }}>{analytics.completedAppointments}</p>
                      </div>
                      <div>
                        <p style={labelStyle}>Cancelled Ratio</p>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: colors.danger }}>{analytics.cancelledAppointments}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p>Loading stats...</p>
              )}
            </div>
          )}

          {user.role === 'admin' && activeTab === 'doctors' && (
            <div>
              <h2 style={headingStyle}>Doctor Management</h2>

              <div style={gridStyle(2)}>
                {/* Promote to doctor form */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>Promote User to Doctor</h3>
                  <form onSubmit={handlePromoteToDoctor}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Select User</label>
                      <select style={inputStyle} value={promoteUserId} onChange={e => setPromoteUserId(e.target.value)} required>
                        <option value="">-- Choose User --</option>
                        {adminUsers.filter(u => u.role !== 'doctor').map(u => (
                          <option key={u._id} value={u._id}>
                            {u.profile.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Medical Specialization</label>
                      <input 
                        style={inputStyle} 
                        type="text" 
                        value={promoteSpec} 
                        onChange={e => setPromoteSpec(e.target.value)} 
                        required 
                        placeholder="e.g. Cardiology, Orthopedics" 
                      />
                    </div>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Education / Qualifications</label>
                      <input 
                        style={inputStyle} 
                        type="text" 
                        value={promoteEduc} 
                        onChange={e => setPromoteEduc(e.target.value)} 
                        required 
                        placeholder="e.g. MD - Harvard Medical School, FACC" 
                      />
                    </div>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Biography / Clinician Info</label>
                      <textarea 
                        style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} 
                        value={promoteBio} 
                        onChange={e => setPromoteBio(e.target.value)} 
                        placeholder="Clinical qualifications..." 
                      />
                    </div>

                    <button style={{ ...btnStyle(), width: '100%' }} type="submit">
                      Set Role to Doctor
                    </button>
                  </form>
                </div>

                {/* List of active doctors */}
                <div style={cardStyle}>
                  <h3 style={subheadingStyle}>Active Doctors List</h3>
                  {doctorsList.length === 0 ? (
                    <p style={{ color: colors.textSecondary }}>No active doctors on the platform.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {doctorsList.map(doc => (
                        <div key={doc._id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px'
                        }}>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '15px' }}>{doc.user?.profile?.name || 'Dr. Practitioner'}</p>
                            <p style={{ fontSize: '13px', color: colors.primary }}>{doc.specialization} • <span style={{color: colors.textSecondary}}>{doc.education || 'Credentials'}</span></p>
                            <p style={{ fontSize: '11px', color: colors.textSecondary }}>{doc.user?.email}</p>
                          </div>
                          <button style={btnStyle('danger')} onClick={() => handleDemoteDoctor(doc._id)}>
                            Demote
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {user.role === 'admin' && activeTab === 'users' && (
            <div style={cardStyle}>
              <h2 style={headingStyle}>User Accounts moderation</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                      <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Name</th>
                      <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Email</th>
                      <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Role</th>
                      <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Status</th>
                      <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map(u => (
                      <tr key={u._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '16px 8px', fontWeight: 600 }}>{u.profile.name}</td>
                        <td style={{ padding: '16px 8px' }}>{u.email}</td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={badgeStyle('')}>{u.role}</span>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={badgeStyle(u.profile.status)}>{u.profile.status}</span>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          {u.role !== 'admin' && (
                            <button 
                              style={btnStyle(u.profile.status === 'suspended' ? 'success' : 'danger')}
                              onClick={() => handleToggleUserStatus(u._id, u.profile.status)}
                            >
                              {u.profile.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {user.role === 'admin' && activeTab === 'appointments' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ ...headingStyle, marginBottom: 0 }}>System Appointments</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={sidebarButtonStyle(adminApptFilter === 'all')} onClick={() => setAdminApptFilter('all')}>
                    All
                  </button>
                  <button style={sidebarButtonStyle(adminApptFilter === 'scheduled')} onClick={() => setAdminApptFilter('scheduled')}>
                    Scheduled
                  </button>
                  <button style={sidebarButtonStyle(adminApptFilter === 'completed')} onClick={() => setAdminApptFilter('completed')}>
                    Completed
                  </button>
                  <button style={sidebarButtonStyle(adminApptFilter === 'cancelled')} onClick={() => setAdminApptFilter('cancelled')}>
                    Cancelled
                  </button>
                </div>
              </div>

              {appointments.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>No consultations logged.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Patient</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Doctor</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Date & Time</th>
                        <th style={{ padding: '12px 8px', color: colors.textSecondary }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments
                        .filter(a => adminApptFilter === 'all' || a.status === adminApptFilter)
                        .map(appt => (
                          <tr key={appt._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td style={{ padding: '16px 8px', fontWeight: 600 }}>{appt.patient?.profile?.name || 'Patient'}</td>
                            <td style={{ padding: '16px 8px' }}>{appt.doctor?.profile?.name || 'Doctor'}</td>
                            <td style={{ padding: '16px 8px' }}>{appt.date} at {appt.timeSlot}</td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={badgeStyle(appt.status)}>{appt.status}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}


          {/* =======================================================
              REAL-TIME CHAT INTERFACE
              ======================================================= */}
          {activeTab === 'chat' && (
            <div style={{ ...cardStyle, height: '600px', display: 'flex', padding: 0 }}>
              {/* Partner Select list */}
              <div style={{ width: '250px', borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
                <p style={{ padding: '16px', fontWeight: 600, borderBottom: `1px solid ${colors.border}`, fontFamily: 'Outfit, sans-serif' }}>
                  {user.role === 'patient' ? 'Contact Clinician' : 'Active Patient List'}
                </p>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {chatList.length === 0 ? (
                    <p style={{ padding: '16px', color: colors.textSecondary, fontSize: '13px' }}>No chat contacts available.</p>
                  ) : (
                    chatList.map(ch => (
                      <div 
                        key={ch._id}
                        onClick={() => handleSelectChatPartner(ch)}
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          backgroundColor: chatPartner && chatPartner._id === ch._id ? `${colors.primary}10` : 'transparent',
                          borderBottom: `1px solid ${colors.border}`,
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        <p style={{ fontSize: '14px', fontWeight: 600, color: chatPartner && chatPartner._id === ch._id ? colors.primary : colors.text }}>
                          {ch.name}
                        </p>
                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                          {ch.role === 'doctor' ? ch.specialization : ch.email}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {chatPartner ? (
                  <>
                    {/* Chat header */}
                    <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}`, backgroundColor: `${colors.border}10` }}>
                      <p style={{ fontWeight: 600, fontSize: '15px' }}>{chatPartner.name}</p>
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                        {chatPartner.role === 'doctor' ? `Clinician Specialty: ${chatPartner.specialization}` : 'Patient Chat Channel'}
                      </span>
                    </div>

                    {/* Messages logs */}
                    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {messages.map((msg, i) => {
                        const isSelf = msg.sender === user._id;
                        return (
                          <div 
                            key={i} 
                            style={{
                              alignSelf: isSelf ? 'flex-end' : 'flex-start',
                              maxWidth: '70%',
                              backgroundColor: isSelf ? colors.primary : `${colors.border}50`,
                              color: isSelf ? '#ffffff' : colors.text,
                              padding: '10px 14px',
                              borderRadius: isSelf ? '12px 12px 0 12px' : '12px 12px 12px 0',
                              fontSize: '14px'
                            }}
                          >
                            <p>{msg.content}</p>
                            <span style={{
                              fontSize: '9px',
                              color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
                              display: 'block',
                              textAlign: 'right',
                              marginTop: '4px'
                            }}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Message sending box */}
                    <div style={{ padding: '16px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px' }}>
                      <input 
                        style={{ ...inputStyle, flex: 1 }} 
                        type="text" 
                        value={newMessageText} 
                        onChange={e => setNewMessageText(e.target.value)}
                        placeholder="Type message here..." 
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      />
                      <button style={btnStyle()} onClick={handleSendMessage}>
                        Send
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: colors.textSecondary }}>Select a contact from the list to start messaging.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* =======================================================
          MODAL OVERLAYS (PRESCRIPTION & PATIENT HISTORY)
          ======================================================= */}
      
      {/* 1. Add Prescription Notes Modal */}
      {prescriptionApptId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 200
        }}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: '480px', margin: 0 }}>
            <h3 style={headingStyle}>Complete consultation note</h3>
            <form onSubmit={handleSavePrescription}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Write Prescription / Medication / Recommendations</label>
                <textarea 
                  style={{ ...inputStyle, minHeight: '120px', fontFamily: 'inherit', resize: 'vertical' }}
                  required
                  value={prescriptionNoteInput}
                  onChange={e => setPrescriptionNoteInput(e.target.value)}
                  placeholder="Amoxicillin 500mg - 3x daily for 7 days. Bed rest."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button style={btnStyle('secondary')} type="button" onClick={() => setPrescriptionApptId(null)}>
                  Cancel
                </button>
                <button style={btnStyle('success')} type="submit">
                  Finish Consultation & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Patient History Modal (Doctor checkup feature) */}
      {showPatientHistoryModal && selectedPatientHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 200,
          padding: '24px'
        }}>
          <div style={{ 
            ...cardStyle, 
            width: '100%', 
            maxWidth: '800px', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            margin: 0 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={headingStyle}>{selectedPatientHistory.name} - Clinical History</h2>
              <button style={btnStyle('secondary')} onClick={() => {
                setShowPatientHistoryModal(false);
                setSelectedPatientHistory(null);
              }}>
                Close History
              </button>
            </div>

            {/* Health Logs */}
            <h3 style={subheadingStyle}>1. Physical Logs Summary</h3>
            {selectedPatientHistory.logs.length === 0 ? (
              <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '20px' }}>No recorded logs.</p>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <th style={{ padding: '6px' }}>Date</th>
                      <th style={{ padding: '6px' }}>Weight</th>
                      <th style={{ padding: '6px' }}>Blood Pressure</th>
                      <th style={{ padding: '6px' }}>Blood Sugar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPatientHistory.logs.map((l, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '6px' }}>{new Date(l.date).toLocaleDateString()}</td>
                        <td style={{ padding: '6px' }}>{l.weight ? `${l.weight} kg` : '--'}</td>
                        <td style={{ padding: '6px' }}>{l.bloodPressureSystolic ? `${l.bloodPressureSystolic}/${l.bloodPressureDiastolic} mmHg` : '--'}</td>
                        <td style={{ padding: '6px' }}>{l.bloodSugar ? `${l.bloodSugar} mg/dL` : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Medications */}
            <h3 style={subheadingStyle}>2. Active Medications</h3>
            {selectedPatientHistory.medications.length === 0 ? (
              <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '20px' }}>No recorded medications.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {selectedPatientHistory.medications.map((m, i) => (
                  <div key={i} style={{ padding: '10px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px' }}>
                    <p style={{ fontWeight: 600 }}>{m.name} ({m.dosage})</p>
                    <p>{m.frequency} — from {new Date(m.startDate).toLocaleDateString()} to {new Date(m.endDate).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Medical Records */}
            <h3 style={subheadingStyle}>3. Uploaded Medical Records (PDF)</h3>
            {selectedPatientHistory.records.length === 0 ? (
              <p style={{ color: colors.textSecondary, fontSize: '13px' }}>No documents uploaded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedPatientHistory.records.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px' }}>
                    <span>📄 {r.fileName}</span>
                    <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, fontWeight: 600, textDecoration: 'none' }}>
                      Open Report PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
