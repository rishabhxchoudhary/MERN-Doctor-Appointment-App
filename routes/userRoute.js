const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middlewares/authmiddleware');
const moment = require('moment');

const router = express.Router();
const User = require('../models/userModel');
const doctorModel = require('../models/doctorModel');
const Appointment = require('../models/appointmentModel');
const authmiddleware = require('../middlewares/authmiddleware');

router.post('/register', async (req, res) => {
    try {
        const userExists = await User.findOne({ email: req.body.email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists', success: false });
        }
        const password = req.body.password;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        req.body.password = hashedPassword;
        const newUser = new User(req.body);
        await newUser.save();
        res.status(200).json({ message: 'User registered successfully', success: true });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error Creating User', success: false, error });
    }
})

router.post("/login", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(200).send({ message: "User does not exist", success: false });
        }
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(200).send({ message: "Password is incorrect", success: false });
        } else {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: "1d",
            });
            res.status(200).send({ message: "Login successful", success: true, data: token });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Error logging in", success: false, error });
    }
});

router.post('/get-user-info-by-id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById({ _id: req.body.userId });
        if (!user) {
            res.status(200).send({ message: "User does not exist", success: false });
        }
        else {
            res.status(200).send({
                success: true, data: { ...user._doc, password: '' }
            });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Error getting user info", success: false, error });

    }
});

router.post('/apply-doctor-account', authmiddleware, async (req, res) => {
    try {
        const newDoctor = new doctorModel({ ...req.body, status: 'pending' });
        await newDoctor.save();
        const adminUser = await User.findOne({ isAdmin: true });
        const unseenNotifications = adminUser.unseenNotifications;
        unseenNotifications.push({
            type: "new-doctor-request",
            message: `${newDoctor.firstName} ${newDoctor.lastName} has applied for a doctor account}`,
            data: {
                doctorId: newDoctor._id,
                name: newDoctor.firstName + " " + newDoctor.lastName
            },
            onClickPath: "/admin/doctors"
        });
        await User.findOneAndUpdate(adminUser._id, { unseenNotifications });
        res.status(200).send({ message: "Doctor account applied successfully", success: true });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error Applying Doctor', success: false, error });
    }
})

router.post('/mark-all-notifications-as-seen', authmiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.body.userId });
        const unseenNotifications = user.unseenNotifications;
        const seenNotifications = user.seenNotifications;
        seenNotifications.push(...unseenNotifications);
        user.seenNotifications = seenNotifications;
        user.unseenNotifications = [];
        const updatedUser = await user.save();
        updatedUser.password = undefined;
        res.status(200).send({ message: "Notifications marked as seen", success: true, data: updatedUser });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error Applying Doctor', success: false, error });
    }
})

router.post('/delete-all-notifications', authmiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.body.userId });
        user.seenNotifications = [];
        user.unseenNotifications = [];
        const updatedUser = await user.save();
        updatedUser.password = undefined;
        res.status(200).send({ message: "Notifications marked as seen", success: true, data: updatedUser });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error Applying Doctor', success: false, error });
    }
})

router.get("/get-all-approved-doctors", authMiddleware, async (req, res) => {
    try {
        const doctors = await doctorModel.find({ status: "approved" });
        res.status(200).send({
            message: "Doctors fetched successfully",
            success: true,
            data: doctors,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Error applying doctor account",
            success: false,
            error,
        });
    }
});

router.post("/book-appointment", authMiddleware, async (req, res) => {
    try {
        req.body.status = "pending";
        req.body.date = moment(req.body.date, "DD-MM-YYYY").toISOString();
        req.body.time = moment(req.body.time, "HH:mm").toISOString();
        const newAppointment = new Appointment(req.body);
        await newAppointment.save();
        //pushing notification to doctor based on his userid
        const user = await User.findOne({ _id: req.body.doctorInfo.userId });
        user.unseenNotifications.push({
            type: "new-appointment-request",
            message: `A new appointment request has been made by ${req.body.userInfo.name}`,
            onClickPath: "/doctor/appointments",
        });
        await user.save();
        res.status(200).send({
            message: "Appointment booked successfully",
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Error booking appointment",
            success: false,
            error,
        });
    }
});

router.post("/check-booking-avilability", authMiddleware, async (req, res) => {
    try {
        const date = moment(req.body.date, "DD-MM-YYYY").toISOString();
        const fromTime = moment(req.body.time, "HH:mm")
            .subtract(1, "hours")
            .toISOString();
        const toTime = moment(req.body.time, "HH:mm").add(1, "hours").toISOString();
        const doctorId = req.body.doctorId;
        const appointments = await Appointment.find({
            doctorId,
            date,
            time: { $gte: fromTime, $lte: toTime },
        });
        if (appointments.length > 0) {
            return res.status(200).send({
                message: "Appointments not available",
                success: false,
            });
        } else {
            return res.status(200).send({
                message: "Appointments available",
                success: true,
            });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Error booking appointment",
            success: false,
            error,
        });
    }
});

router.get("/get-appointments-by-user-id", authMiddleware, async (req, res) => {
    try {
        const appointments = await Appointment.find({ userId: req.body.userId });
        res.status(200).send({
            message: "Appointments fetched successfully",
            success: true,
            data: appointments,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Error fetching appointments",
            success: false,
            error,
        });
    }
});
module.exports = router;