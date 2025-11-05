const User = require('../models/user');
const Task = require('../models/task');
const respond = require('../utils/response');

module.exports = function (router) {
  const usersRoute = router.route("/users");
  const usersIDRoute = router.route("/users/:id");

  // GET: list of users
  usersRoute.get(async (req, res) => {
    try {
      const { where, sort, select, skip, limit, count } = req.query;
      let query = User.find();

      if (where) query = query.find(JSON.parse(where));
      if (sort) query = query.sort(JSON.parse(sort));
      if (select) query = query.select(JSON.parse(select));
      if (skip) query = query.skip(parseInt(skip));
      if (limit) query = query.limit(parseInt(limit));

      if (count === "true") {
        const num = await query.countDocuments();
        return respond(res, 200, "User count retrieved", num);
      }

      const users = await query.exec();
      respond(res, 200, "Users retrieved successfully", users);
    } catch (err) {
      respond(res, 400, "Failed to fetch users");
    }
  });

  // POST: create user
  usersRoute.post(async (req, res) => {
    try {
      const { name, email, pendingTasks } = req.body;
      if (!name || !email)
        return respond(res, 400, "Name and email are required");

      const newUser = new User({
        name,
        email,
        pendingTasks: pendingTasks || []
      });

      const savedUser = await newUser.save();
      respond(res, 201, "User created successfully", savedUser);
    } catch (err) {
      if (err.code === 11000)
        respond(res, 400, "Email already exists");
      else
        respond(res, 500, "Server error creating user");
    }
  });

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
      if (!name || !email)
        return respond(res, 400, "Name and email are required");

      const user = await User.findById(req.params.id);
      if (!user) return respond(res, 404, "User not found");

      // Unassign this user's current tasks
      await Task.updateMany(
        { assignedUser: user._id },
        { $set: { assignedUser: "", assignedUserName: "unassigned" } }
      );

      // Update user
      user.name = name;
      user.email = email;
      user.pendingTasks = pendingTasks || [];
      await user.save();

      // Assign new pending tasks
      if (pendingTasks && pendingTasks.length > 0) {
        await Task.updateMany(
          { _id: { $in: pendingTasks } },
          { $set: { assignedUser: user._id, assignedUserName: user.name } }
        );
      }

      respond(res, 200, "User updated successfully", user);
    } catch (err) {
      respond(res, 500, "Server error updating user");
    }
  });

  // DELETE user
  usersIDRoute.delete(async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) return respond(res, 404, "User not found");

      // Unassign their tasks
      await Task.updateMany(
        { assignedUser: user._id },
        { $set: { assignedUser: "", assignedUserName: "unassigned" } }
      );

      respond(res, 204, "User deleted successfully");
    } catch {
      respond(res, 500, "Server error deleting user");
    }
  });

  return router;
};
