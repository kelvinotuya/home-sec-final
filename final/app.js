var db = firebase.database();
var listRef, usersRef, eventRef, taskRef, membersRef;

firebase.auth().onAuthStateChanged(function(userInfo) {
  if (userInfo) {
    //save user data in localstorage
    setUserLoggedIn(userInfo);

    //check if user data is stored in the db
    var userbase = firebase.database().ref("/users/" + userInfo.uid);
    userbase.once("value").then(function(snapshot) {
      var record = snapshot.val();
      if (!record || record.email !== userInfo.email) {
        var user = {
          email: userInfo.email,
          name:
            state.newUser && state.newUser.name
              ? state.newUser.name
              : userInfo.email
        };
        var updates = {};
        updates[`/users/${userInfo.uid}`] = user;
        return firebase
          .database()
          .ref()
          .update(updates);
        //delete state.newUser;
      }
    });
    // ...
  } else {
    // User is signed out.
    // ...
  }
});

state.usersRef = db.ref(`users`);

state.usersRef.once("value", function(snapshot) {
  var users = snapshot.val() || {};
  var appUsers = Object.keys(users).map(function(key) {
    return {
      id: key,
      name: users[key]["name"],
      email: users[key]["email"]
    };
  });
  initUsers(state, appUsers);
});

//Users CRUD
function initUsers(state, data) {
  state.users = data;
  //getMembers(state);
}

function getUser(id) {
  var users = getUsers();
  return users.find(function(item) {
    return item.id == id;
  });
}

function getUsers() {
  return state.users || [];
}

function FindUsers(name) {
  return state.users.filter(function(item) {
    return item.name.includes(name) && item.id !== state.profile.uid;
  });
}

function FindUser(name) {
  return state.users.find(function(item) {
    return item.name.includes(name);
  });
}

function checkLogin() {
  if (!state.authenticated) {
    $.mobile.navigate("#login");
  }
}

function login(data) {
  firebase
    .auth()
    .signInWithEmailAndPassword(data.email, data.password)
    .then(authData => {
      setAuthState(authData.user);
      reset("#loginForm");
      $.mobile.navigate("#list");
    })
    .catch(err => {
      console.warn(err);
    });
}

function register(data) {
  firebase
    .auth()
    .createUserWithEmailAndPassword(data.email, data.password)
    .then(res => {
      reset("#registerForm");
      state.newUser = {
        name: data.name,
        email: data.email,
        response: res
      };
    })
    .then(() => {
      login(data);
    })
    .catch(function(error) {
      // Handle Errors here.
      var errorCode = error.code;
      var errorMessage = error.message;
      // ...
    });
}

function logout() {
  firebase
    .auth()
    .signOut()
    .then(
      function(data) {
        // Sign-out successful.
        clearUserData();
        setAuthState();
        $.mobile.navigate("#login");
      },
      function(error) {
        // An error happened.
      }
    );
}

function reset(formId) {
  $(formId)[0].reset();
}

$(document).on("pagebeforeshow", "#login", function() {
  if (state.authenticated) {
    $.mobile.navigate("#list");
  }
  //user adds new task
  $("#loginForm").submit(function(e) {
    e.preventDefault();
    var email = $("#username").val();
    var password = $("#pass").val();
    if (email && password) {
      login({
        email,
        password
      });
    }
    return false;
  });
});

$(document).on("pagebeforeshow", "#register", function() {
  if (state.authenticated) {
    $.mobile.navigate("#list");
  }
  $("#registerForm").submit(function(e) {
    e.preventDefault();
    var name = $("#name").val(),
      email = $("#email").val(),
      password = $("#password").val(),
      password2 = $("#password2").val();

    if (email && password && password === password2) {
      register({
        name: name,
        email: email,
        password: password
      });
    }
  });
});

$(document).on("pagebeforehide", "#list", function() {
  // entering page 1
  if (typeof state.listRef === "object") {
    state.listRef.off("child_added", listRef);
  }
  state.events = [];
});

$(document).on("pagebeforeshow", "#list", function() {
  checkLogin();
  renderChecklists(state.events); //initial render before data
  //state CRUD functions
  function getListItem(id) {
    return state.events.find(function(item) {
      return item.id == id;
    });
  }

  function addList(state, data) {
    if (getListItem(data.id)) {
      return;
    }
    state.events.push({
      id: data.id,
      name: data.name,
      description: data.description,
      start: data.start,
      time: data.time
    });
    renderChecklists(state.events);
  }

  function removeList(state, id) {
    state.events = state.events.filter(function(item) {
      return item.id !== id;
    });
    renderChecklists(state.events);
  }

  //function to show lists
  function renderChecklists(items = []) {
    if (items.length < 1) {
      $(".empty-checklist").show();
      $(".list-checklist").hide();
    } else {
      $(".empty-checklist").hide();
      $(".list-checklist").show();
      var lists = items.map(function(item) {
        return `
        <li data-id="${item.id}">          
          <a href="#" class="task"><span class="event-name">${
            item.name
          }</span></a>          
          <a href="#" class="delete">Delete</a>
        </li>
		  `;
      });
      $("ul.checklist").html(lists);
      $("ul.checklist").listview("refresh");
    }
  }

  state.listRef = db.ref(`lists`);

  //firebase listeners
  listRef = state.listRef.on("child_added", function(snapshot) {
    var glob = snapshot.val();
    if (
      (glob.owner && glob.owner === state.profile.uid) ||
      (glob.members && glob.members.includes(state.profile.uid))
    ) {
      var data = {
        id: snapshot.key,
        name: glob.name,
        description: glob.description,
        start: glob.start,
        time: glob.time
      };
      addList(state, data); //push to local state
    }
  });

  state.listRef.on("child_removed", function(snapshot) {
    removeList(state, snapshot.key); //remove from local state
  });

  //firebase CRUD functions
  function newChecklist(data) {
    data.owner = state.profile.uid;
    state.listRef.push(data);
    $("#listForm")[0].reset();
    $("#popupEvent").popup("close");
  }

  function deleteChecklist(id) {
    state.listRef.child(id).remove();
  }

  //user adds new task
  $("#listForm").submit(function(e) {
    e.preventDefault();
    var name = $(".newlist").val();
    var description = $(".desc").val();
    var start = $("#start").val();
    var time = $("#time").val();
    if (name) {
      newChecklist({ name, description, start, time }); //create new task on server
    }

    return false;
  });

  //user removes event
  $("ul.checklist").on("click", ".delete", function() {
    var id = $(this)
      .parent()
      .attr("data-id");
    deleteChecklist(id);
  });

  //user clicks on event
  $("#list").on("click", ".task", function(e) {
    e.preventDefault();
    var id = $(this)
      .parent()
      .attr("data-id");
    state.event = getListItem(id);
    //Change page
    $.mobile.navigate("#tasks", { event: getListItem(id) });
  });
});

$(document).on("pagebeforehide", "#tasks", function() {
  // entering page1
  if (typeof state.taskRef === "object") {
    //state.taskRef.off('child_added', taskRef);
    //state.eventRef.off('value', eventRef);
    //state.membersRef.off('value', membersRef);
  }
  state.current = {};
  state.jobs = [];
});

$(document).on("pagebeforeshow", "#tasks", function() {
  checkLogin();
  if (state.event && state.event.name) {
    eventTitle(state.event.name);
  }
  renderTasks(state.jobs); //initial render before data

  //state CRUD functions

  //Events
  function updateEvent(state, data) {
    state.event = data;
    var members = getMembers(state);
    eventTitle(state.event.name);
    renderMembers([...new Set(members)]);
    //renderTasks(state.jobs);
  }

  function editEvent(id, key, value) {
    state.eventRef.child(key).set(value);
  }

  //Tasks
  function addTask(state, data) {
    if (getTask(data.id)) {
      return;
    }
    state.jobs.push({
      id: data.id,
      task: data.task,
      status: data.status
    });
    renderTasks(state.jobs);
  }

  function getTask(id) {
    return state.jobs.find(function(item) {
      return item.id == id;
    });
  }

  function updateTask(state, data) {
    var item = state.jobs.find(function(item) {
      return item.id === data.id;
    });
    item.status = data.status;
    item.task = data.task;
    renderTasks(state.jobs);
  }

  function removeTask(state, id) {
    state.jobs = state.jobs.filter(function(item) {
      return item.id !== id;
    });
    renderTasks(state.jobs);
  }

  function removeCompletedTask(state) {
    state.jobs.forEach(function(item) {
      if (item.status) {
        deleteTask(item.id);
      }
    });
  }

  //function to show todos
  function renderTasks(items = []) {
    if (items.length < 1) {
      $(".empty-todos").show();
      $(".tasks").hide();
    } else {
      $(".empty-todos").hide();
      $(".tasks").show();
      var lists = items.map(function(item) {
        return `
           <li data-id=${item.id}>
              <a class="status">
                <input class='check' type=\"checkbox\" ${
                  item.status ? "checked" : ""
                } />
              </a>
              <a class='todoItem'>
                <span class='taskText ${
                  item.status ? "strikethrough" : ""
                }'>${item.task}</span>
              </a>
              <a href="#" class="delete">Delete</a>
				   </li>
			   `;
      });
      $("ul.todos").html(lists);
      $("ul.todos").listview("refresh");
    }
  }

  //function to show todos
  function renderMembers(members) {
    if (Array.isArray(members) && members.length > 0) {
      var lists = members.map(function(item) {
        var user = getUser(item);
        return user
          ? `
           <li data-id=${user.id}>
           <a href="#">
						  <span class='userItem'>${user.name}</span>
             </a>
             <a href="#" class="delete">Delete</a>
				   </li>
         `
          : "";
      });
      $(".user-list").html(lists);
      $(".user-list-wrapper").show();
      $(".empty-user-list").hide();
    } else {
      $(".empty-user-list").show();
      $(".user-list-wrapper").hide();
      $(".user-list").html("");
    }
  }

  function eventTitle(title) {
    $("#event-name").html(`<span contenteditable="true">${title}</span>`);
  }

  state.eventRef = db.ref(`lists/${state.event.id}`);
  state.taskRef = db.ref(`todos/${state.event.id}/items`);
  state.membersRef = state.eventRef.child("members");

  state.eventRef.on("value", function(snapshot) {
    var event = snapshot.val();
    updateEvent(state, event);
  });

  //firebase listeners
  state.taskRef.on("child_added", function(snapshot) {
    var data = {
      id: snapshot.key,
      task: snapshot.val().task,
      status: snapshot.val().status
    };
    addTask(state, data); //push to local state
  });

  state.taskRef.on("child_changed", function(snapshot, prevSnap) {
    var data = {
      id: snapshot.key,
      task: snapshot.val().task,
      status: snapshot.val().status
    };
    updateTask(state, data); //update local state
  });

  state.taskRef.on("child_removed", function(snapshot) {
    removeTask(state, snapshot.key); //remove from local state
  });

  //firebase CRUD functions
  //Members
  function getMembers(state) {
    return state.event.members || [];
  }

  function addMember(id) {
    var members = getMembers(state);
    var exst = members.find(function(item) {
      return item === id;
    });

    if (exst) {
      return;
    }
    members.push(id);
    state.membersRef.set(members);
  }

  function removeMember(id) {
    var members = getMembers(state);
    if (Array.isArray(members)) {
      members = members.filter(function(item) {
        item !== id;
      });
      state.membersRef.set(members);
    }
  }

  //Tasks
  function newTask(data) {
    state.taskRef.push(data);
    $("#taskForm")[0].reset();
    $("#popupJob").popup("close");
  }

  function editTask(id, key, value) {
    state.taskRef
      .child(id)
      .child(key)
      .set(value);
  }

  function deleteTask(id) {
    state.taskRef.child(id).remove();
  }

  //UI interactions

  //Event
  //show edit input for event
  $("#event-name")
    .on("focus", "[contenteditable]", function() {
      var $this = $(this);
      $this.data("before", $this.html());
    })
    .on("blur keyup paste input", "[contenteditable]", function() {
      const $this = $(this);
      if ($this.data("before") !== $this.html()) {
        var value = $this.html();
        var key = "name";
        var id = state.event.id;
        editEvent(id, key, value);
      }
    });

  //members
  var sugList = $("#suggestions");

  sugList.on("click", "li", function() {
    var id = $(this).data("id");
    addMember(id);
    sugList.html("");
    sugList.listview("refresh");
  });

  $("#searchField").on("input", function(e) {
    var text = $(this).val();
    if (text.length < 3) {
      sugList.html("");
      sugList.listview("refresh");
    } else {
      var users = FindUsers(text);
      var options = users.map(function(user) {
        return `<li data-id="${user.id}"><a href="#">${user.name}</a></li>`;
      });
      sugList.html(options);
      sugList.listview("refresh");
    }
  });
  //user removes task
  $("ul.user-list").on("click", ".delete", function() {
    var id = $(this)
      .parent()
      .attr("data-id");
    removeMember(id);
  });

  //Jobs
  //user adds new task
  $("#taskForm").submit(function() {
    var input = $(".newTask").val();
    if (input) {
      newTask({ task: input, status: false }); //create new task on server
    }
    return false;
  });

  //show edit input for task
  $("ul.todos").on("dblclick", "li", function(e) {
    var text = $(this)
      .find(".taskText")
      .text();
    $(this).html("<input type='text' class='editTodo'>");
    $(this)
      .find(".editTodo")
      .val(text);
    $(this)
      .find(".editTodo")
      .focus();
    e.stopImmediatePropagation();
  });

  //user edits task name
  $("ul.todos").on("keypress focusout", ".editTodo", function(e) {
    if (e.keyCode && e.keyCode != 13) {
      //if keycode exists, meaning its a keyboard event, and it doesn't equal 13, exit, otherwise it's focusout or 13
      return;
    }
    var value = $(this).val();
    var li = $(this).parent();
    var id = li.attr("data-id");
    var key = "task";
    editTask(id, key, value); //push new name to server
  });

  //user changes status of task
  $("ul.todos").on("click", ".check", function() {
    var item = $(this)
      .parent()
      .parent();
    var id = item.attr("data-id");
    var item = getTask(id);
    var key = "status";
    editTask(id, key, !item.status);
  });

  //user removes task
  $("ul.todos").on("click", ".delete", function() {
    var id = $(this)
      .parent()
      .attr("data-id");
    deleteTask(id);
  });

  //user clears all complete tasks
  $(".delete").on("click", function() {
    removeCompletedTask(state);
  });
});

