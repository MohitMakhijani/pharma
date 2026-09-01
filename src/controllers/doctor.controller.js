const doctorService = require('../services/doctor.service');

async function getDoctors(req, res) {
  try {
    const doctors = await doctorService.getDoctors(req.user.storeId, req.query);
    return res.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch doctors',
    });
  }
}

async function getDoctorById(req, res) {
  try {
    const doctor = await doctorService.getDoctorById(req.params.id, req.user.storeId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }
    return res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch doctor',
    });
  }
}

async function createDoctor(req, res) {
  try {
    const doctor = await doctorService.createDoctor(req.body, req.user.storeId);
    return res.status(201).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create doctor',
    });
  }
}

async function updateDoctor(req, res) {
  try {
    const doctor = await doctorService.updateDoctor(req.params.id, req.body, req.user.storeId);
    return res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update doctor',
    });
  }
}

async function deleteDoctor(req, res) {
  try {
    const deleted = await doctorService.deleteDoctor(req.params.id, req.user.storeId);
    return res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete doctor',
    });
  }
}

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
