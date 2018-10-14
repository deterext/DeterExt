script = document.createElement('script');


script.textContent = `
var modified_worker = (function () {

	class deter_element {

		constructor(priority, func, context, params, flag) {
			this.endTime = priority;
			this.context = context;
			this.func = func;
			this.params = params;
			this.flag = flag;
			this.finish = false;
		}

		toString() {
			return "(" + this.endTime + "," + this.context + "," + this.func + ",[[" + this.params + "]]," + this.flag + "," + this.finish + ")";
		}

	}

	class deter_pq {

		constructor() {
			this.data = [];
		}

		push(element) {
			let i = 0;
			// Get the index of the first element in the queue with priority greater than the one given
			for (; i < this.data.length && this.data[i].endTime < element.endTime; i++);

			// If flag of element to insert is 1, insert the element before
			if (element.flag === 1) {
				this.data.splice(i, 0, element);
				return;
			}

			// Get index of first element that has a greater priority, OR same priority with flag 1 (whichever comes first)
			for (; i < this.data.length && this.data[i].endTime === element.endTime && this.data[i].flag === 0; i++);

			this.data.splice(i, 0, element);
		}

		pop() {
			if (this.size() > 0) return this.data.shift();
		}

		top() {
			return this.data[0];
		}

		size() {
			return this.data.length;
		}

		toString() {
			let res = "";
			for (let i = 0; i < this.data.length; i++) {
				res += this.data[i].toString() + ";";
			}
			return res;
		}

	}

	// Our global counter variable
	let _deter_counter_ = 0;

	// Create our queue
	var __event_queue__ = new deter_pq();


	// Push an element of flag 1 to the queue that will block queue execution when at the head. 
	// Also, push an empty element with a priority of the current timestamp and a flag of 2 to the queue.
	// Therefore, every time this function is called, the counter is incremented.

	var __event_begin__ = function (eet, cb, context, params) {
		if (typeof eet != "number") {
			return;
		}
		let endTime = _deter_counter_ + eet;
		let e = new deter_element(endTime, cb, context, params, 1);
		__event_queue__.push(e);
		return e;
	}

	var __event_insert__ = function (endTime, cb, context, params) {
		if (typeof endTime != "number") {
			return;
		}
		let e = new deter_element(endTime, cb, context, params, 0);
		__event_queue__.push(e);
		__deter_dispatch__(0);
	}

	let __event_recover_clock__ = function () {
		let e = new deter_element(parseInt(old_performance.call(performance)) - deter_performance_base, null, null, null, 2);
		__event_queue__.push(e);
	}


	// Push an element of flag 0 to the queue that will be ran immediately when at the head of the queue.

	var __event_end__ = function (event) {
		event.flag = 0;
		__deter_dispatch__(0);
	}

	var __deter_dispatch__ = function (flag) {
		__event_recover_clock__();

		while (__event_queue__.size() > 0) {
			if (__event_queue__.top().flag == 1 && __event_queue__.top().finish == false) break;

			let e = __event_queue__.pop();

			if (e.flag === 1) {
				if (e.endTime > _deter_counter_) _deter_counter_ = e.endTime;
			}
			// If the first element has flag 0, pop and run the callback, and assign counter to its priority
			else if (e.flag === 0) {
				_deter_counter_ = e.endTime;

				if (e.func != null && e.finish == false) {
					e.finish = true;
					try {
						e.func.apply(e.context, e.params);
					} catch (err) {
						console.log(err);
					}
				}
			}
			// If first element has flag 2, it is simply a timestamp to move our counter forward
			else if (e.flag === 2) {
				if (e.endTime > _deter_counter_ && __event_queue__.size() == 0) {
					_deter_counter_ = e.endTime;
				}
			}
			// Otherwise, if dispatch was called with flag 2, pop the first element. Otherwise, break.
			else {}

		}


	}

	// Override for the performance.now function - increments and returns our counter
	let deter_performance_origin = performance.timeOrigin;
	let deter_performance_base = performance.now();
	let old_performance = performance.now;
	performance.now = function () {
		__deter_dispatch__(0);
		let tmp_counter = _deter_counter_;
		_deter_counter_ += 1;
		return deter_performance_base + tmp_counter;
	}

	// Override for the performance.now function - increments and returns our counter
	let deter_date_base = Date.now();
	let old_Date_now = Date.now;
	Date.now = function () {
		_deter_counter_ += 1;
		return deter_date_base + _deter_counter_;
	}

	let deter_setTimeout_event = {};
	// Override setTimeout to, after the delay specified, push the callback given to our queue
	let old_setTimeout = setTimeout;
	setTimeout = function () {
		let cb = arguments[0];
		let delay = arguments[1];
		let params = Array.prototype.slice.call(arguments);
		if (typeof delay != "number" || delay < 0) delay = 0;
		let deter_event = __event_begin__(delay, cb, null, params);
		let deter_cb = function () {
			__event_end__(deter_event);
		}
		params[0] = deter_cb;
		let id = old_setTimeout.apply(null, params);
		deter_setTimeout_event[id] = deter_event;
		return id;
	}

	let old_clearTimeout = clearTimeout;
	clearTimeout = function () {
		let params = Array.prototype.slice.call(arguments);
		let id = params[0];
		if (id in deter_setTimeout_event) {
			deter_setTimeout_event[id].finish = true;
		}
		return old_clearTimeout.apply(null, params);
	}

	let old_setInterval = setInterval;
	let setInterval_id = 0;
	let setInterval_id_map = {};
	setInterval = function () {
		let cb = arguments[0];
		let delay = arguments[1];
		let deter_cb = function () {
			let params = Array.prototype.slice.call(arguments);
			cb.apply(null, params);
			params.unshift(delay);
			params.unshift(cb);
			setInterval_id_map[setInterval_id] = setInterval.apply(null, params);
		}
		let params = Array.prototype.slice.call(arguments);
		params[0] = deter_cb;
		let id = setTimeout.apply(null, params);
		let tmp_id = setInterval_id;
		setInterval_id_map[tmp_id] = id;
		setInterval_id += 1;
		return id;
	}

	let old_clearInterval = clearInterval;
	clearInterval = function () {
		let params = Array.prototype.slice.call(arguments);
		let id = params[0];
		return clearTimeout(id);
	}

	let next_window_onerror = null;
	let next_window_onerror_params = null;
	let have_next_window_onerror = false;
	let old_windowonerror = window.onerror;
	window.onerror = function () {
		if (arguments[0] == "Uncaught SyntaxError: Unexpected identifier" || arguments[0] == "Script error.") {
			next_window_onerror = function () {
				old_windowonerror.apply(window, next_window_onerror_params);
			}
			next_window_onerror_params = Array.prototype.slice.call(arguments);
			have_next_window_onerror = true;
		} else {
			if (old_windowonerror != null) old_windowonerror.apply(window, Array.prototype.slice.call(arguments));
		}
	}

	Object.defineProperty(window, 'onerror', {
		set: function (e) {
			old_windowonerror = e;

		}
	});

	// Override the Element.appendChild function to safely execute for typical targets of attacks:
	// appending images and script elements to a page
	let old_appendChild = Element.prototype.appendChild;
	Element.prototype.appendChild = function () {

		// If the element being appended is not of concern, do it the old way
		if (arguments[0].tagName != 'SCRIPT' && arguments[0].tagName != 'IMG') {
			return old_appendChild.apply(this, arguments);
		}

		// Average duration to append an element to the page we want to show every time
		let avgDuration = 10;

		// Append the blocking element with flag 1 to the queue
		arguments[0].deter_event = __event_begin__(avgDuration, null, null, null);
		//arguments[0].deter_event = new deter_element( _deter_counter_ + avgDuration, null, arguments[0], null, 0);
		//arguments[0].deter_event.finish = true;
		old_setTimeout(function(){arguments[0].deter_event.finish = true;}, 1000, arguments[0]);

		arguments[0].old_onload_handler = arguments[0].onload;

		// Override what to do when the element loads on the page
		arguments[0].onload = function () {
			this.deter_event.func = this.old_onload_handler;
			this.deter_event.context = this;
			this.deter_event.params = Array.prototype.slice.call(arguments);
			if(this.deter_event.finish == false)__event_end__(this.deter_event);
			else __event_insert__(this.deter_event.endTime, this.deter_event.func, this.deter_event.context, this.deter_event.params);
			if (this.tagName == 'SCRIPT' && have_next_window_onerror) {
				have_next_window_onerror = false;
				__event_insert__(this.deter_event.endTime, next_window_onerror, window, null);
			}
		}

		Object.defineProperty(arguments[0], 'onload', {
			set: function (e) {
				this.old_onload_handler = e;

			}
		});

		arguments[0].old_onerror_handler = arguments[0].onerror;

		arguments[0].onerror = function () {
			this.deter_event.func = this.old_onerror_handler;
			this.deter_event.context = this;
			this.deter_event.params = Array.prototype.slice.call(arguments);
			if(this.deter_event.finish == false)__event_end__(this.deter_event);
			else __event_insert__(this.deter_event.endTime, this.deter_event.func, this.deter_event.context, this.deter_event.params);
		}

		Object.defineProperty(arguments[0], 'onerror', {
			set: function (e) {
				this.old_onerror_handler = e;
			}
		});

		return old_appendChild.apply(this, arguments);
	}

	let __deter_old_requestAnimationFrame__ = requestAnimationFrame;
	let __deter_requestAnimationFrame_map__ = {};
	requestAnimationFrame = function (cb) {
		let time = 100;
		let deter_event = __event_begin__(time, cb, null, null);
		var __deter_cb__ = function () {
			__event_end__(deter_event);
		}


		let id = __deter_old_requestAnimationFrame__(__deter_cb__);
		__deter_requestAnimationFrame_map__[id] = deter_event;
		return id;
	}

	let __deter_old_cancelAnimationFrame__ = cancelAnimationFrame;
	cancelAnimationFrame = function (requestID) {
		__deter_requestAnimationFrame_map__[requestID].finish = true;
		return __deter_old_cancelAnimationFrame__(requestID);
	}

	let __deter_old_postMessage__ = window.postMessage;
	let __deter_postMessage_map__ = {};
	window.postMessage = function () {
		let params = Array.prototype.slice.call(arguments);
		let deter_event = __event_begin__(10, null, null, null);
		__deter_postMessage_map__[params[0]] = deter_event;
		__deter_old_postMessage__.apply(window, params);
		old_setTimeout(__event_end__, 5, deter_event);
	}

	let __deter_old_window_onmessage__ = window.onmessage;
	window.onmessage = function () {
		let params = Array.prototype.slice.call(arguments);
		let msg = params[0].data;
		if (params[0].source == params[0].target && msg in __deter_postMessage_map__) {
			let deter_event = __deter_postMessage_map__[msg];
			deter_event.func = __deter_old_window_onmessage__;
			deter_event.context = window;
			let tmp_timeStamp = deter_event.endTime;
			let onmessage_event_handler = {
				get: (obj, prop) => {
					return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
				}
			};
			let deter_onmessage_event = new Proxy(params[0], onmessage_event_handler);
			deter_event.params = [deter_onmessage_event];
			__event_end__(deter_event);
		} else {
			__event_insert__(_deter_counter_ + 100, __deter_old_window_onmessage__, window, params);
		}
	}

	Object.defineProperty(window, 'onmessage', {
		set: function (e) {
			__deter_old_window_onmessage__ = e;

		}
	});

	var worker_inject_script = function () {

		kernelWorkerInterface = (function () {

			class deter_element {

				constructor(priority, func, context, params, flag) {
					this.endTime = priority;
					this.context = context;
					this.func = func;
					this.params = params;
					this.flag = flag;
					this.finish = false;
				}

				toString() {
					return "(" + this.endTime + "," + this.context + "," + this.func + ",[[" + this.params + "]]," + this.flag + "," + this.finish + ")";
				}

			}

			class deter_pq {

				constructor() {
					this.data = [];
				}

				push(element) {
					let i = 0;
					// Get the index of the first element in the queue with priority greater than the one given
					for (; i < this.data.length && this.data[i].endTime < element.endTime; i++);

					// If flag of element to insert is 1, insert the element before
					if (element.flag === 1) {
						this.data.splice(i, 0, element);
						return;
					}

					// Get index of first element that has a greater priority, OR same priority with flag 1 (whichever comes first)
					for (; i < this.data.length && this.data[i].endTime === element.endTime && this.data[i].flag === 0; i++);

					this.data.splice(i, 0, element);
				}

				pop() {
					if (this.size() > 0) return this.data.shift();
				}

				top() {
					return this.data[0];
				}

				size() {
					return this.data.length;
				}

				toString() {
					let res = "";
					for (let i = 0; i < this.data.length; i++) {
						res += this.data[i].toString() + ";";
					}
					return res;
				}

			}

			// Our global counter variable
			let _deter_counter_ = 0;

			// Create our queue
			var __event_queue__ = new deter_pq();


			// Push an element of flag 1 to the queue that will block queue execution when at the head. 
			// Also, push an empty element with a priority of the current timestamp and a flag of 2 to the queue.
			// Therefore, every time this function is called, the counter is incremented.

			var __event_begin__ = function (eet, cb, context, params) {
				if (typeof eet != "number") {
					return;
				}
				let endTime = _deter_counter_ + eet;
				let e = new deter_element(endTime, cb, context, params, 1);
				__event_queue__.push(e);
				return e;
			}

			var __event_insert__ = function (endTime, cb, context, params) {
				if (typeof endTime != "number") {
					return;
				}
				let e = new deter_element(endTime, cb, context, params, 0);
				__event_queue__.push(e);
				__deter_dispatch__(0);
			}

			let __event_recover_clock__ = function () {
				let e = new deter_element(parseInt(old_performance.call(performance)) - deter_performance_base, null, null, null, 2);
				__event_queue__.push(e);
			}


			// Push an element of flag 0 to the queue that will be ran immediately when at the head of the queue.
			// Note: This may be used to replace an element previously inserted with flag 1.

			var __event_end__ = function (event) {
				event.flag = 0;
				__deter_dispatch__(0);
			}

			var __deter_dispatch__ = function (flag) {
				__event_recover_clock__();

				while (__event_queue__.size() > 0) {
					if (__event_queue__.top().flag == 1 && __event_queue__.top().finish == false) break;

					let e = __event_queue__.pop();

					if (e.flag === 1) {
						if (e.endTime > _deter_counter_) _deter_counter_ = e.endTime;
					}
					// If the first element has flag 0, pop and run the callback, and assign counter to its priority
					else if (e.flag === 0) {
						_deter_counter_ = e.endTime;

						if (e.func != null && e.finish == false) {
							e.finish = true;
							try {
								e.func.apply(e.context, e.params);
							} catch (err) {
								console.log(err);
							}
						}
					}
					// If first element has flag 2, it is simply a timestamp to move our counter forward
					else if (e.flag === 2) {
						if (e.endTime > _deter_counter_ && __event_queue__.size() == 0) {
							_deter_counter_ = e.endTime;
						}
					}
					// Otherwise, if dispatch was called with flag 2, pop the first element. Otherwise, break.
					else {}

				}

			}

			// Override for the performance.now function - increments and returns our counter
			let deter_performance_origin = performance.timeOrigin;
			let deter_performance_base = performance.now();
			let old_performance = performance.now;
			performance.now = function () {
				__deter_dispatch__(0);
				let tmp_counter = _deter_counter_;
				_deter_counter_ += 1;
				return deter_performance_base + tmp_counter;
			}

			// Override for the performance.now function - increments and returns our counter
			let deter_date_base = Date.now();
			let old_Date_now = Date.now;
			Date.now = function () {
				_deter_counter_ += 1;
				return deter_date_base + _deter_counter_;
			}

			let deter_setTimeout_event = {};
			// Override setTimeout to, after the delay specified, push the callback given to our queue
			let old_setTimeout = setTimeout;
			setTimeout = function () {
				let cb = arguments[0];
				let delay = arguments[1];
				let params = Array.prototype.slice.call(arguments);
				if (typeof delay != "number" || delay < 0) delay = 0;
				let deter_event = __event_begin__(delay, cb, null, params);
				let deter_cb = function () {
					__event_end__(deter_event);
				}
				params[0] = deter_cb;
				let id = old_setTimeout.apply(null, params);
				deter_setTimeout_event[id] = deter_event;
				//old_setTimeout(__event_end__, delay + 1, deter_event);
				return id;
			}

			let old_clearTimeout = clearTimeout;
			clearTimeout = function () {
				let params = Array.prototype.slice.call(arguments);
				let id = params[0];
				if (id in deter_setTimeout_event) {
					deter_setTimeout_event[id].finish = true;
				}
				return old_clearTimeout.apply(null, params);
			}

			let old_setInterval = setInterval;
			let setInterval_id = 0;
			let setInterval_id_map = {};
			setInterval = function () {
				let cb = arguments[0];
				let delay = arguments[1];
				let deter_cb = function () {
					let params = Array.prototype.slice.call(arguments);
					cb.apply(null, params);
					params.unshift(delay);
					params.unshift(cb);
					setInterval_id_map[setInterval_id] = setInterval.apply(null, params);
				}
				let params = Array.prototype.slice.call(arguments);
				params[0] = deter_cb;
				let id = setTimeout.apply(null, params);
				let tmp_id = setInterval_id;
				setInterval_id_map[tmp_id] = id;
				setInterval_id += 1;
				return id;
			}

			let old_clearInterval = clearInterval;
			clearInterval = function () {
				let params = Array.prototype.slice.call(arguments);
				let id = params[0];
				return clearTimeout(id);
			}

			let __deter_old_postMessage__ = postMessage;
			let __deter_postMessage_map__ = {};
			postMessage = function () {
				let params = Array.prototype.slice.call(arguments);
				//let deter_event = __event_begin__(100, null, null, null);
				//__deter_postMessage_map__[params[0]] = deter_event;
				__deter_old_postMessage__.apply(self, params);
				//old_setTimeout(__event_end__, 5, deter_event);
			}

			onmessage = function () {
				let params = Array.prototype.slice.call(arguments);
      	if ("deter_topic" in params[0].data){
        	if(params[0].data.deter_topic == "_deter_postmessage_event_"){
          	let e = params[0].data.deter_buf;
          	let msg = params[0].data.deter_postmessage_msg;
            __deter_postMessage_map__[msg] = e;
            __event_queue__.push(e);
          }
          else if(params[0].data.deter_topic == "_deter_init_"){
          	deter_performance_base = params[0].data.deter_buf[0];
          }
        	return;
        }
				let msg = params[0].data;
				if (msg in __deter_postMessage_map__) {
					let deter_event = __deter_postMessage_map__[msg];
					deter_event.func = __deter_old_this_onmessage__;
					deter_event.context = self;
					let tmp_timeStamp = deter_event.endTime;
					let onmessage_event_handler = {
						get: (obj, prop) => {
							return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
						}
					};
					let deter_onmessage_event = new Proxy(params[0], onmessage_event_handler);
					deter_event.params = [deter_onmessage_event];
					__event_end__(deter_event);
				} else {
					__event_insert__(_deter_counter_ + 10, __deter_old_this_onmessage__, this, params);
				}
			}

			Object.defineProperty(self, 'onmessage', {
				set: function (e) {
					__deter_old_this_onmessage__ = e;

				}
			});

			return {
				src: "user worker path here"
			};

		})();

		self.importScripts(kernelWorkerInterface.src);

	}

	let _deter_old_worker_ = Worker;
	var kernelInterface = (function () {
		kernelWorker = Worker;
		constructWorker = function (userWorker) {

			var worker_inject_script_txt = worker_inject_script.toString();
			worker_inject_script_txt = worker_inject_script_txt.replace("user worker path here", userWorker.name);

			var blob = new Blob(["(" + worker_inject_script_txt + ")()"], {
				type: 'application/javascript'
			});
			var worker = new _deter_old_worker_(URL.createObjectURL(blob));
			return worker;
		};
		return {
			constructWorker
		};
	})();

	var worker_handler = {
		set: (obj, prop, val) => {
			if (prop == "onmessage") {
				let _deter_old_onmessage_ = val;
				let _deter_onmessage_ = function () {
					let params = Array.prototype.slice.call(arguments);
					let tmp_timeStamp = _deter_counter_ + 10;
					let onmessage_event_handler = {
						get: (obj, prop) => {
							return prop == 'timeStamp' ? tmp_timeStamp : obj[prop];
						}
					};
					let deter_onmessage_event = new Proxy(params[0], onmessage_event_handler);
					__event_insert__(tmp_timeStamp, _deter_old_onmessage_, obj, [deter_onmessage_event]);
				}
				obj[prop] = _deter_onmessage_;
			} else {
				obj[prop] = val;
			}
		},
    get: function(target, name, receiver) {
    	if (name in target.__proto__) {
        if(name == "postMessage"){
        	return function(...args) {
          	let e = new deter_element(_deter_counter_ + 10, null, null, null, 1);
          	target.postMessage({deter_topic: '_deter_postmessage_event_',deter_postmessage_msg: args[0] ,deter_buf: e});
          	target[name](args);
      		};
        } else {
        	return function(...args) {
          	target[name](args);
      		};
        }
    	}
    },
		construct: (obj, prop) => {
			if(prop[0].substring(0,5) == "blob:" || prop[0].substring(0,5) == "http:" || prop[0].substring(0,6) == "https:")url = prop[0];
			else{
				var loc = window.location.href;
				var dir = loc.substring(0, loc.lastIndexOf('/'));
				url = dir + '/' + prop[0];
			}
			var myworker = {
				name: url
			};
			let realworker = kernelInterface.constructWorker(myworker);
			let res = new Proxy(realworker, worker_handler);
      realworker.postMessage({deter_topic: '_deter_init_', deter_buf: [deter_performance_base]});
			return res;
		}
	}

	Worker = new Proxy(Function, worker_handler);

	//return {"__event_queue__":__event_queue__};

})();

function unit_test_worker() {

	var worker_function = function () {

		for (var i = 0; i < 10; i++) {
			console.log("postMessage " + i);
			self.postMessage(i);
		}
	}

	function loop(e) {
		console.log("loop " + e.data);
		console.log(e.timeStamp);
	}
	var blob = new Blob(["(" + worker_function.toString() + ")()"], {
		type: 'application/javascript'
	});
	var worker = new Worker(URL.createObjectURL(blob));
	worker.onmessage = loop

}

//unit_test_worker();

function unit_test_worker2() {
	// worker.js:
	var worker_function = function () {
		/*for (var i = 1; i <= 10050; i++) {
			postMessage(i);
		}*/
    onmessage = function(e){
  		console.log(performance.now());
    	console.log("real worker onmessage: " + e.data);
    }
	}

	var blob = new Blob(["(" + worker_function.toString() + ")()"], {
		type: 'application/javascript'
	});

	worker = new Worker(URL.createObjectURL(blob));
	startTime = performance.now();
	worker.onmessage = function (event) {
		count = event.data;
		NUM = 10000;
		if (event.data == NUM) {
			console.log("onmessage " + event.data);
			tick = (performance.now() - startTime) / NUM;
			console.log(performance.now() - startTime);
			console.log(tick);
			callback = function () {
				console.log("request cb");
				asyncTimerDuration = tick * (count - NUM);
				console.log("asyncTimerDuration");
				console.log(asyncTimerDuration);
			}
			document.getElementById("e").classList.toggle('f');
			requestAnimationFrame(callback);
		}
	}
  console.log(performance.now());
  worker.postMessage("Hello from main");
}

unit_test_worker2();
`;

document.documentElement.appendChild(script);
