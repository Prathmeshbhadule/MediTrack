const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('meditrack_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { message: await response.text() };
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || 'Something went wrong';
    throw new Error(errorMsg);
  }
  return data;
};

export const api = {
  // Authentication & Profile
  auth: {
    register: async (email, password, name) => {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password, name })
      });
      return handleResponse(response);
    },
    login: async (email, password) => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password })
      });
      return handleResponse(response);
    },
    doctorLogin: async (email, password) => {
      const response = await fetch(`${API_BASE}/auth/doctor-login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password })
      });
      return handleResponse(response);
    },
    getProfile: async () => {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    updateProfile: async (profileData) => {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(profileData)
      });
      return handleResponse(response);
    }
  },

  // Doctors & Specialties
  doctors: {
    list: async () => {
      const response = await fetch(`${API_BASE}/doctors`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    listSpecializations: async () => {
      const response = await fetch(`${API_BASE}/specializations`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    }
  },

  // Appointments
  appointments: {
    book: async (doctorId, date, timeSlot) => {
      const response = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ doctorId, date, timeSlot })
      });
      return handleResponse(response);
    },
    list: async (status = '') => {
      const url = status ? `${API_BASE}/appointments?status=${status}` : `${API_BASE}/appointments`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    updateStatus: async (id, status) => {
      const response = await fetch(`${API_BASE}/appointments/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      return handleResponse(response);
    },
    addPrescription: async (id, prescriptionNotes) => {
      const response = await fetch(`${API_BASE}/appointments/${id}/prescription`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ prescriptionNotes })
      });
      return handleResponse(response);
    }
  },

  // Health Logs
  health: {
    addLog: async (logData) => {
      const response = await fetch(`${API_BASE}/health-logs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(logData)
      });
      return handleResponse(response);
    },
    listLogs: async (patientId = '') => {
      const url = patientId ? `${API_BASE}/health-logs?patientId=${patientId}` : `${API_BASE}/health-logs`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    }
  },

  // Medical Records (Cloudinary Multer File Upload)
  records: {
    upload: async (formData) => {
      const response = await fetch(`${API_BASE}/medical-records`, {
        method: 'POST',
        headers: getHeaders(true), // isMultipart = true
        body: formData
      });
      return handleResponse(response);
    },
    list: async (patientId = '') => {
      const url = patientId ? `${API_BASE}/medical-records?patientId=${patientId}` : `${API_BASE}/medical-records`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    delete: async (id) => {
      const response = await fetch(`${API_BASE}/medical-records/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(response);
    }
  },

  // Medication Tracker
  medications: {
    add: async (medData) => {
      const response = await fetch(`${API_BASE}/medications`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(medData)
      });
      return handleResponse(response);
    },
    list: async (patientId = '') => {
      const url = patientId ? `${API_BASE}/medications?patientId=${patientId}` : `${API_BASE}/medications`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    delete: async (id) => {
      const response = await fetch(`${API_BASE}/medications/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(response);
    }
  },

  // Socket chat history
  chat: {
    getHistory: async (partnerId) => {
      const response = await fetch(`${API_BASE}/chat/history/${partnerId}`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    }
  },

  // Admin Dashboard
  admin: {
    getAnalytics: async () => {
      const response = await fetch(`${API_BASE}/admin/analytics`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    listUsers: async () => {
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    updateUserStatus: async (id, status) => {
      const response = await fetch(`${API_BASE}/admin/users/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      return handleResponse(response);
    },
    promoteDoctor: async (docData) => {
      const response = await fetch(`${API_BASE}/admin/doctors`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(docData)
      });
      return handleResponse(response);
    },
    demoteDoctor: async (doctorIdOrUserId) => {
      const response = await fetch(`${API_BASE}/admin/doctors/${doctorIdOrUserId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(response);
    }
  }
};
