require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Doctor = require('./models/Doctor');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meditrack';
    await mongoose.connect(mongoUri);
    console.log('Database connected for seeding.');

    // Clear existing data (optional, but let's keep it safe by just checking existence)
    // 1. Seed Admin
    const existingAdmin = await User.findOne({ email: 'admin@meditrack.com' });
    if (!existingAdmin) {
      const adminUser = new User({
        email: 'admin@meditrack.com',
        password: 'adminpassword123', // will be hashed automatically by User schema pre-save hook
        role: 'admin',
        profile: {
          name: 'System Administrator',
          status: 'active'
        }
      });
      await adminUser.save();
      console.log('Admin user seeded: admin@meditrack.com / adminpassword123');
    } else {
      console.log('Admin user already exists.');
    }

    // 1.5. Seed Patient
    const existingPatient = await User.findOne({ email: 'patient@meditrack.com' });
    if (!existingPatient) {
      const patientUser = new User({
        email: 'patient@meditrack.com',
        password: 'patientpassword123',
        role: 'patient',
        profile: {
          name: 'John Doe',
          age: 35,
          bloodGroup: 'O+',
          allergies: 'Penicillin',
          emergencyContact: '+1 555-0199',
          status: 'active'
        }
      });
      await patientUser.save();
      console.log('Patient user seeded: patient@meditrack.com / patientpassword123');
    } else {
      console.log('Patient user already exists.');
    }

    // 2. Seed Doctors
    const doctorsList = [
      {
        email: 'doctor.alice@meditrack.com',
        password: 'doctorpassword123',
        name: 'Dr. Alice Stone',
        specialization: 'Cardiology',
        biography: 'Senior cardiologist with over 15 years of experience treating cardiovascular disease and managing heart wellness programs.',
        education: 'MD, FACC - Harvard Medical School',
        days: ['Monday', 'Wednesday', 'Friday'],
        slots: ['09:00', '10:00', '11:00', '14:00', '15:00']
      },
      {
        email: 'doctor.bob@meditrack.com',
        password: 'doctorpassword123',
        name: 'Dr. Bob Martin',
        specialization: 'Dermatology',
        biography: 'Certified dermatologist specialized in clinical skincare, acne treatments, allergy management, and laser therapies.',
        education: 'MD - Johns Hopkins School of Medicine',
        days: ['Tuesday', 'Thursday'],
        slots: ['10:00', '11:00', '12:00', '15:00', '16:00']
      },
      {
        email: 'doctor.clara@meditrack.com',
        password: 'doctorpassword123',
        name: 'Dr. Clara Oswald',
        specialization: 'Pediatrics',
        biography: 'Dedicated pediatrician who loves working with children and toddlers. Focused on developmental tracking and preventative checkups.',
        education: 'MD, FAAP - Stanford University School of Medicine',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        slots: ['09:00', '10:00', '14:00', '15:00', '16:00']
      }
    ];

    for (const doc of doctorsList) {
      let existingUser = await User.findOne({ email: doc.email });
      if (!existingUser) {
        // Create user
        const user = new User({
          email: doc.email,
          password: doc.password,
          role: 'doctor',
          profile: {
            name: doc.name,
            status: 'active'
          }
        });
        await user.save();

        // Create doctor profile
        const doctorProfile = new Doctor({
          user: user._id,
          specialization: doc.specialization,
          biography: doc.biography,
          education: doc.education,
          schedule: {
            days: doc.days,
            slots: doc.slots
          }
        });
        await doctorProfile.save();
        console.log(`Doctor seeded: ${doc.email} / ${doc.password} (Specialty: ${doc.specialization})`);
      } else {
        console.log(`Doctor user ${doc.email} already exists.`);
        // Ensure profile exists
        let profile = await Doctor.findOne({ user: existingUser._id });
        if (!profile) {
          profile = new Doctor({
            user: existingUser._id,
            specialization: doc.specialization,
            biography: doc.biography,
            education: doc.education,
            schedule: {
              days: doc.days,
              slots: doc.slots
            }
          });
          await profile.save();
          console.log(`Re-created missing Doctor profile details for ${doc.email}`);
        } else {
          // Update education for existing profiles
          profile.education = doc.education;
          await profile.save();
          console.log(`Updated education for existing doctor ${doc.email}`);
        }
      }
    }

    console.log('Database seeding successfully finished.');
    await mongoose.disconnect();
  } catch (error) {
    console.warn('\n========================================================================');
    console.warn('⚠️  MONGODB CONNECTION WARNING:');
    console.warn('Could not seed database because MONGODB_URI in backend/.env is not configured');
    console.warn('or cannot connect. Please update MONGODB_URI with your MongoDB Atlas link.');
    console.warn('Error details:', error.message);
    console.warn('========================================================================\n');
    process.exit(0);
  }
};

seedData();
