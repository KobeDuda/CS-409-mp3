const mongoose = require('mongoose');
const User = require('../models/user');
const respond = require('../utils/response');

const taskSchema = new mongoose.Schema({
  name: String,
  description: String,
  deadline: Date,
  completed: Boolean,
  assignedUser: { type: String, default: "" },
  assignedUserName: { type: String, default: "unassigned" },
  dateCreated: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

module.exports = function (router) {
  const tasksRoute = router.route("/tasks");
  const tasksIDRoute = router.route("/tasks/:id");

  // ===============================
  // /tasks
  // ===============================

  // GET: list of tasks with filters
  tasksRoute.get(async (req, res) => {
    try {
      const {
        where,
        sort,
        select,
        skip,
        limit,
        count
      } = req.query;

      let query = Task.find();

      if (where) query = query.find(JSON.parse(where));
      if (sort) query = query.sort(JSON.parse(sort));
      if (select) query = query.select(JSON.parse(select));
      if (skip) query = query.skip(parseInt(skip));
      query = query.limit(limit ? parseInt(limit) : 100); // default limit 100

      if (count === "true") {
        const num = await query.countDocuments();
        return respond(res, 200, "Task count retrieved successfully", num);
      }

      const tasks = await query.exec();
      respond(res, 200, "Tasks retrieved successfully", tasks);
    } catch (err) {
      respond(res, 400, "Failed to fetch tasks");
    }
  });

  // POST: create a task
  tasksRoute.post(async (req, res) => {
    try {
      const { name, description, deadline, completed, assignedUser } = req.body;

      let assignedUserName = "unassigned";
      if (assignedUser) {
        const user = await User.findById(assignedUser);
        if (user) {
          assignedUserName = user.name;
        } else {
          return respond(res, 400, "Invalid user ID");
        }
      }

      const newTask = new Task({
        name,
        description,
        deadline,
        completed: completed || false,
        assignedUser: assignedUser || "",
        assignedUserName
      });

      const savedTask = await newTask.save();

      // If assigned user exists, add task ID to their pendingTasks
      if (assignedUser) {
        await User.findByIdAndUpdate(assignedUser, {
          $push: { pendingTasks: savedTask._id }
        });
      }

      respond(res, 201, "Task created successfully", savedTask);
    } catch {
      respond(res, 400, "Failed to create task");
    }
  });

  // ===============================
  // /tasks/:id
  // ===============================

  // GET specific task
  tasksIDRoute.get(async (req, res) => {
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return respond(res, 404, "Task not found");
      respond(res, 200, "Task retrieved successfully", task);
    } catch {
      respond(res, 400, "Invalid task ID");
    }
  });

  // PUT replace task
  tasksIDRoute.put(async (req, res) => {
    try {
      const { name, description, deadline, completed, assignedUser } = req.body;

      const oldTask = await Task.findById(req.params.id);
      if (!oldTask) return respond(res, 404, "Task not found");

      // Remove from old user’s pendingTasks
      if (oldTask.assignedUser) {
        await User.findByIdAndUpdate(oldTask.assignedUser, {
          $pull: { pendingTasks: oldTask._id }
        });
      }

      // Get new user info
      let assignedUserName = "unassigned";
      if (assignedUser) {
        const user = await User.findById(assignedUser);
        if (user) assignedUserName = user.name;
        else return respond(res, 400, "Invalid user ID");
      }

      const updatedTask = await Task.findByIdAndUpdate(
        req.params.id,
        { name, description, deadline, completed, assignedUser, assignedUserName },
        { new: true, overwrite: true, runValidators: true }
      );

      if (assignedUser) {
        await User.findByIdAndUpdate(assignedUser, {
          $push: { pendingTasks: updatedTask._id }
        });
      }

      respond(res, 200, "Task updated successfully", updatedTask);
    } catch {
      respond(res, 400, "Failed to update task");
    }
  });

  // DELETE task
  tasksIDRoute.delete(async (req, res) => {
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return respond(res, 404, "Task not found");

      if (task.assignedUser) {
        await User.findByIdAndUpdate(task.assignedUser, {
          $pull: { pendingTasks: task._id }
        });
      }

      await Task.findByIdAndDelete(req.params.id);
      respond(res, 200, "Task deleted successfully", task);
    } catch {
      respond(res, 400, "Failed to delete task");
    }
  });

  return router;
};
