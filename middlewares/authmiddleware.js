const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).send({ message: "Token is invalid", success: false });
            } else {
                req.body.userId = decoded.id;
                next();
            }
        })
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Error getting user info", success: false, error });
    }
}