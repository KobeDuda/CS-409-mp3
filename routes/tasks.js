const Task = require('../models/task');
const User = require('../models/user');
const respond = require('../utils/response');

module.exports = function (router) {
  const tasksRoute = router.route("/tasks");
  const tasksIDRoute = router.route("/tasks/:id");

  // GET tasks
  tasksRoute.get(async (req, res) => {
    try {
      const { where, sort, select, skip, limit, count } = req.query;
      let query = Task.find();

      if (where) query = query.find(JSON.parse(where));
      if (sort) query = query.sort(JSON.parse(sort));
      if (select) query = query.select(JSON.parse(select));
      if (skip) query = query.skip(parseInt(skip));
      query = query.limit(limit ? parseInt(limit) : 100);

      if (count === "true") {
        const num = await query.countDocuments();
        return respond(res, 200, "Task count retrieved", num);
      }

      const tasks = await query.exec();
      respond(res, 200, "Tasks retrieved successfully", tasks);
    } catch {
      respond(res, 400, "Failed to fetch tasks");
    }
  });

  // POST task
  tasksRoute.post(async (req, res) => {
    try {
      const { name, description, deadline, completed, assignedUser } = req.body;
      if (!name || !deadline)
        return respond(res, 400, "Name and deadline are required");

      let assignedUserName = "unassigned";
      if (assignedUser) {
        const user = await User.findById(assignedUser);
        if (user) assignedUserName = user.name;
        else return respond(res, 400, "Invalid assigned user");
      }

      const newTask = new Task({
        name,
        description: description || "",
        deadline,
        completed: completed || false,
        assignedUser: assignedUser || "",
        assignedUserName
      });

      const savedTask = await newTask.save();

      if (assignedUser) {
        await User.findByIdAndUpdate(assignedUser, {
          $push: { pendingTasks: savedTask._id }
        });
      }

      respond(res, 201, "Task created successfully", savedTask);
    } catch {
      respond(res, 500, "Server error creating task");
    }
  });

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
      if (!name || !deadline)
        return respond(res, 400, "Name and deadline are required");

      const oldTask = await Task.findById(req.params.id);
      if (!oldTask) return respond(res, 404, "Task not found");

      // Remove from old user's pending tasks
      if (oldTask.assignedUser) {
        await User.findByIdAndUpdate(oldTask.assignedUser, {
          $pull: { pendingTasks: oldTask._id }
        });
      }

      // Set assigned user
      let assignedUserName = "unassigned";
      if (assignedUser) {
        const user = await User.findById(assignedUser);
        if (!user) return respond(res, 400, "Invalid assigned user");
        assignedUserName = user.name;
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
      respond(res, 500, "Server error updating task");
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
      respond(res, 204, "Task deleted successfully");
    } catch {
      respond(res, 500, "Server error deleting task");
    }
  });

  return router;
};
