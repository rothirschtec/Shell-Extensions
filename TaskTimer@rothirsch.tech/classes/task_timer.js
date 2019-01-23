const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const TaskItem = Extension.imports.classes.task_item;
const Utils = Extension.imports.classes.utils;
const new_task = Extension.imports.classes.new_task;

const ADD_ICON = Gio.icon_new_for_string(Extension.path + "/icons/add_icon.png");

const KEY_RETURN = 65293;
const KEY_ENTER = 65421;

function TaskTimer() {
    this.next_id = 0;
    this._init();
}

TaskTimer.prototype = {
  __proto__: PanelMenu.Button.prototype,

  _init : function(){
    this.dirPath = GLib.get_home_dir() + "/.config/TaskTimer/";
    if (! GLib.file_test(this.dirPath, GLib.FileTest.EXISTS)){
      GLib.mkdir_with_parents(this.dirPath, 511);
    }
    this.saveFile = this.dirPath + "saveFile.json";
    this._load();
    PanelMenu.Button.prototype._init.call(this, St.Align.START);
    this.buttonText = new St.Label({y_align: Clutter.ActorAlign.CENTER});
    this.buttonText.text = Utils.convertTime(this.currTime) + ' / ' + Utils.convertTime(this.totalTime);
    this.buttonText.set_style("text-align:center;");
    this.actor.add_actor(this.buttonText);
    this.mainBox = new St.BoxLayout();
    this.mainBox.set_vertical(true);
    let taskBox = new PopupMenu.PopupMenuSection('taskBox');
    taskBox.actor.add_style_class_name("task-box");
    taskBox.one = false;
    taskBox._setOpenedSubMenu = function(subMenu){
      if(taskBox.one) return;
      taskBox.one = true;

      for (var item of taskBox._getMenuItems()){
        item.menu.close();
      }
      if (subMenu != null){
        subMenu.open();
      }
      taskBox.one = false;
    }
    this.taskBox = taskBox;

    var scrollView = new St.ScrollView({style_class: 'vfade',
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC});
    scrollView.add_actor(this.taskBox.actor);
    this.mainBox.add_actor(scrollView);
    var separator = new PopupMenu.PopupSeparatorMenuItem();
    this.mainBox.add_actor(separator.actor);
    this.newTask = new St.Entry({
      name: "newTask",
      hint_text: _("Name..."),
      track_hover: true,
      can_focus: true
    });
    this.newTask.add_style_class_name("new-task-entry");
    let taskText = this.newTask.clutter_text;
    taskText.set_max_length(50);
    taskText.connect('key-press-event', Lang.bind(this,function(o,e){
      let symbol = e.get_key_symbol();
      if (symbol == KEY_RETURN || symbol == KEY_ENTER) {
        if (this.time != 0 && !isNaN(this.time)){
            this._create_task(o.get_text());
            taskText.set_text('');
            this.btn_add.show();
            this.newTaskSection.actor.hide();
        } else {

        }
      }
    }));
    this.btn_add = new St.Button({label: "", track_hover: true});
    let icon = new St.Icon({icon_size: 30, gicon: ADD_ICON});
    this.btn_add.add_actor(icon);
    this.newTaskSection = new PopupMenu.PopupMenuSection();
    this.timeHeader = new St.Label({text:_("New Task"), track_hover: true, y_align: Clutter.ActorAlign.CENTER});
    this.timeHeader.add_style_class_name("new-task-header");
    this.newTaskBox = new St.BoxLayout();
    this.newTaskBox.set_vertical(false);
    this.timeLabel = new St.Label({text:_("0:00"), y_align: Clutter.ActorAlign.CENTER});
    this.timeLabel.add_style_class_name("time-label");
    this.timeSlider = new Slider.Slider(0);
    this.timeSlider.actor.add_style_class_name("new-task-slider");
    this.timeSlider.connect('value-changed', Lang.bind(this, this._onSliderValueChange));
    this.btn_enter = new St.Button({label: ""});
    this.btn_enter.add_style_class_name("enter-button");
    this.btn_enter.connect("clicked", Lang.bind(this, this._onEnterClicked));
    icon = new St.Icon({icon_size: 20, gicon: ADD_ICON});
    this.btn_enter.add_actor(icon);
    this.newTaskBox.add_actor(this.timeLabel);
    this.newTaskBox.add_actor(this.newTask);
    this.newTaskBox.add_actor(this.btn_enter);
    this.newTaskBox.add_actor
    this.mainBox.add_actor(this.btn_add);
    this.btn_add.connect('clicked', Lang.bind(this, this._onAddClicked));
    this.newTaskSection.actor.add_actor(this.timeHeader);
    this.newTaskSection.actor.add_actor(this.timeSlider.actor);
    this.newTaskSection.actor.add_actor(this.newTaskBox);
    this.newTaskSection.actor.add_style_class_name("new-task-box");
    this.newTaskSection.actor.hide();
    this.mainBox.add_actor(this.newTaskSection.actor);
    this.menu.box.add(this.mainBox);
    for (var id in this.listOfTasks){
      this._add_task(this.listOfTasks[id]);
    }
  },

  _onAddClicked : function(){
      this.btn_add.hide();
      this.newTaskSection.actor.show();
  },

  _onEnterClicked : function(){
      if (this.time != 0 && this.newTask.get_text() != ""){
        this._create_task(this.newTask.get_text());
        this.newTask.set_text("");
        this.btn_add.show();
        this.newTaskSection.actor.hide();
      } else if (this.time == 0 && this.newTask.get_text() == ""){
          Main.notify(("Please specify time and name"));
      }
      else if (this.time == 0){
        Main.notify("Please specify a time");
      } else if (this.newTask.get_text() == ""){
        Main.notify("Please enter a name");
      }
  },

  _onSliderValueChange : function(slider, value){
    this.time = Math.floor(Math.floor(value*(1440-this.totalTime/60))/5)*5;
    let hours = (Math.floor(this.time/60.0));
    let minutes = this.time - (60*hours);
    hours = hours.toString();
    if (minutes < 10) minutes = "0" + minutes.toString(); else minutes = minutes.toString();
    this.timeLabel.text = hours + ":" + minutes;

  },

  _create_task : function(text){
    if (text == '' || text == '\n') return;
    let id = this.next_id;
    let color = Utils.generate_color();
    let weekdays = {
      "sunday": "0:00 / 0:00",
      "monday": "0:00 / 0:00",
      "tuesday": "0:00 / 0:00",
      "wednesday": "0:00 / 0:00",
      "thursday": "0:00 / 0:00",
      "friday": "0:00 / 0:00",
      "saturday": "0:00 / 0:00"
    };
    weekdays = Utils.updateWeeklyTimes(weekdays, (new Date).getDay(), 0, this.time*60);
    let task = {
      "id": id,
      "name": text,
      "time": this.time * 60,
      "currTime": 0,
      "color": color,
      "running": false,
      "dateTime": new Date(),
      "weekdays": weekdays
    };
    //this.tasks[id] = task;
    this.listOfTasks[id] = task;
    this.next_id += 1;
    this.totalTime += this.time*60;
    this._save();
    this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
    this._add_task(task);
  },
  _add_task : function(task){
    let item = new TaskItem.Task(task);
    //Main.notify("hello");
    this.taskBox.addMenuItem(item);
    this.timeSlider._moveHandle(0,0);
    item.connect('delete_signal', Lang.bind(this, this._delete_task));
    item.connect('update_signal', Lang.bind(this, this._update_task));
    item.connect('stop_signal', Lang.bind(this, this._stop_all));
    if (task.running){
      item.task.running = false;
      item._startStop();
    }
  },

  _stop_all: function(o, task){
      for (item of this.taskBox._getMenuItems()){
          if (item.task.running && item.task.id != task.id){
            item._startStop();
        }
      }
  },

  _delete_task: function(o, task){
      delete this.listOfTasks[task.id];
      this._save();
      this.currTime = 0;
      this.totalTime = 0;
      for (var id in this.listOfTasks){
        this.currTime += this.listOfTasks[id].currTime;
        this.totalTime += this.listOfTasks[id].time;
      }
      this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
  },

  _update_task: function(o, task){
      this.listOfTasks[task.id] = task;
      this._save();
      this.currTime = 0;
      for (var id in this.listOfTasks){
        this.currTime += this.listOfTasks[id].currTime;
      }
      this.buttonText.text = Utils.convertTime(this.currTime) + " / " + Utils.convertTime(this.totalTime);
  },

  _save: function(){
    let file = Gio.file_new_for_path(this.saveFile);
    let out = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
    Shell.write_string_to_stream(out, JSON.stringify(this.listOfTasks));
    out.close(null);
  },

  _load: function(){
      if(!GLib.file_test(this.saveFile, GLib.FileTest.EXISTS))
          GLib.file_set_contents(this.saveFile, "{}");

      let content = Shell.get_file_contents_utf8_sync(this.saveFile);
      this.listOfTasks = JSON.parse(content);

      this.next_id = 0;
      this.totalTime = 0;
      this.currTime = 0;
      for (var id in this.listOfTasks){
        this.next_id = Math.max(this.next_id, id);
        if (Utils.isSameDay(new Date(this.listOfTasks[id].dateTime))){
            if (this.listOfTasks[id].running){
              elapsedTime = Utils.elapsedTimeInSeconds(new Date(this.listOfTasks[id].dateTime));
              this.listOfTasks[id].currTime += elapsedTime;
          }
        } else {
            this.listOfTasks[id].currTime = 0;
            this.listOfTasks[id].running = false;
            if ((new Date).getDay() == 1){
              this.listOfTasks[id].weekdays = {
                "sunday": "0:00 / 0:00",
                "monday": "0:00 / 0:00",
                "tuesday": "0:00 / 0:00",
                "wednesday": "0:00 / 0:00",
                "thursday": "0:00 / 0:00",
                "friday": "0:00 / 0:00",
                "saturday": "0:00 / 0:00"
              };
            }
        }
        this.totalTime += this.listOfTasks[id].time;
        this.currTime += this.listOfTasks[id].currTime;
      }
      this.next_id++;


  },

  disable: function(){
    for (var task of this.taskBox._getMenuItems()){
        task.actor.disconnect('delete_signal');
        task.actor.disconnect('update_signal');
        task.actor.disconnect('stop_signal');
        task.destroy();
    }
    this.taskBox.removeAll();
  }
}