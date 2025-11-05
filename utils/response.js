module.exports = function respond(res, statusCode, message, data = null) {
    res.status(statusCode).json({
        message,
        data
    });
};