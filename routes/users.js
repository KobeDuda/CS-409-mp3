// routes/users.js
const mongoose = require('mongoose');

const User = require('../models/user');
const respond = require('../utils/response');

module.exports = function (router) {
  const usersRoute = router.route("/users");
  const usersIDRoute = router.route("/users/:id");

  // ===============================
  // /users
  // ===============================

  // GET: list of users with filtering/sorting/selecting/pagination/count
  usersRoute.get(async (req, res) => {
    try {
      const {
        where,
        sort,
        select,
        skip,
        limit,
        count
      } = req.query;

      let query = User.find();

      if (where) query = query.find(JSON.parse(where));
      if (sort) query = query.sort(JSON.parse(sort));
      if (select) query = query.select(JSON.parse(select));
      if (skip) query = query.skip(parseInt(skip));
      if (limit) query = query.limit(parseInt(limit));

      if (count === "true") {
        const num = await query.countDocuments();
        return respond(res, 200, "User count retrieved successfully", num);
      }

      const users = await query.exec();
      respond(res, 200, "Users retrieved successfully", users);
    } catch (err) {
      respond(res, 400, "Failed to fetch users");
    }
  });

  // POST: create new user
  usersRoute.post(async (req, res) => {
    try {
      const { name, email, pendingTasks } = req.body;

      const newUser = new User({
        name,
        email,
        pendingTasks: pendingTasks || []
      });

      const savedUser = await newUser.save();
      respond(res, 201, "User created successfully", savedUser);
    } catch {
      respond(res, 400, "Failed to create user");
    }
  });

  // ===============================
  // /users/:id
  // ===============================

  // GET specific user
  usersIDRoute.get(async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return respond(res, 404, "User not found");
      respond(res, 200, "User retrieved successfully", user);
    } catch {
      respond(res, 400, "Invalid user ID");
    }
  });

  // PUT replace user
  usersIDRoute.put(async (req, res) => {
    try {
      const { name, email, pendingTasks } = req.body;
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { name, email, pendingTasks },
        { new: true, overwrite: true, runValidators: true }
      );
      if (!updatedUser) return respond(res, 404, "User not found");
      respond(res, 200, "User updated successfully", updatedUser);
    } catch {
      respond(res, 400, "Failed to update user");
    }
  });

  // DELETE user
  usersIDRoute.delete(async (req, res) => {
    try {
      const deletedUser = await User.findByIdAndDelete(req.params.id);
      if (!deletedUser) return respond(res, 404, "User not found");
      respond(res, 200, "User deleted successfully", deletedUser);
    } catch {
      respond(res, 400, "Failed to delete user");
    }
  });

  return router;
};
