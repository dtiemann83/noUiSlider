/*! $.noUiSlider
 *  Documentation available at:
 *  http://refreshless.com/nouislider/
 *
 *  Copyright Léon Gersen, https://twitter.com/LeonGersen
 *  Released under the WTFPL license
 *  http://www.wtfpl.net/about/
 */

/*jslint browser: true  */
/*jslint devel: true    */
/*jslint continue: true */
/*jslint plusplus: true */
/*jslint white: true    */

(function( $ ){

	'use strict';

	if ( $.zepto && !$.fn.removeData ) {
		throw new ReferenceError('Zepto is loaded without the data module.');
	}

	$.fn.noUiSlider = function( options, rebuild ){

		var
		// Cache the document and body selectors;
		 doc = $(document)
		,body = $('body')

		// Namespace for binding and unbinding slider events;
		,namespace = '.nui'

		// Copy of the current value function;
		,$VAL = $.fn.val

		// Re-usable list of classes;
		,clsList = [
		/*  0 */  'noUi-base'
		/*  1 */ ,'noUi-origin'
		/*  2 */ ,'noUi-handle'
		/*  3 */ ,'noUi-input'
		/*  4 */ ,'noUi-active'
		/*  5 */ ,'noUi-state-tap'
		/*  6 */ ,'noUi-target'
		/*  7 */ ,'-lower'
		/*  8 */ ,'-upper'
		/*  9 */ ,'noUi-connect'
		/* 10 */ ,'noUi-vertical'
		/* 11 */ ,'noUi-horizontal'
		/* 12 */ ,'noUi-background'
		/* 13 */ ,'noUi-z-index'
		/* 14 */ ,'noUi-block'
		/* 15 */ ,'noUi-state-blocked'
		/* 16 */ ,'noUi-rtl'
		/* 17 */ ,'noUi-dragable'
		]

		// Determine the events to bind. IE11 implements pointerEvents without
		// a prefix, which breaks compatibility with the IE10 implementation.
		,actions = window.navigator.pointerEnabled ? {
			 start: 'pointerdown'
			,move: 'pointermove'
			,end: 'pointerup'
		} : window.navigator.msPointerEnabled ? {
			 start: 'MSPointerDown'
			,move: 'MSPointerMove'
			,end: 'MSPointerUp'
		} : {
			 start: 'mousedown touchstart'
			,move: 'mousemove touchmove'
			,end: 'mouseup touchend'
		};


// Percentage calculation

	// (percentage) How many percent is this value of this range?
		function fromPercentage ( range, value ) {
			return (value * 100) / ( range[1] - range[0] );
		}

	// (percentage) Where is this value on this range?
		function toPercentage ( range, value ) {
			return fromPercentage( range, range[0] < 0 ?
				value + Math.abs(range[0]) :
					value - range[0] );
		}

	// (value) How much is this percentage on this range?
		function isPercentage ( range, value ) {
			return ((value * ( range[1] - range[0] )) / 100) + range[0];
		}


// Type tests

	// Test in an object is an instance of jQuery or Zepto.
		function isInstance ( object ) {
			return object instanceof $ || ( $.zepto && $.zepto.isZ ( object ) );
		}

	// Checks whether a value is numerical.
		function isNumeric ( a ) {
			return !isNaN( parseFloat( a ) ) && isFinite( a );
		}


// General helper functions

	// Test an array of objects, and calls them if they are a function.
		function call ( functions, scope, args ) {

			// Allow the passing of an unwrapped function.
			// Leaves other code a more comprehensible.
			if( !$.isArray( functions ) ){
				functions = [ functions ];
			}

			$.each( functions, function(){
				if (typeof this === 'function') {
					this.call(scope, args);
				}
			});
		}

	// Round a value to the closest 'to'.
		function closest( value, to ){
			return Math.round(value / to) * to;
		}

	// Format output value to specified standards.
		function format ( value, options ) {

			// Round the value to the resolution that was set
			// with the serialization options.
			value = value.toFixed( options.decimals );

			// Apply the proper decimal mark to the value.
			return value.replace( '.', options.serialization.mark );
		}


// Event abstraction

	// Provide a clean event with standardized offset values.
		function fixEvent ( e ) {

			// Prevent scrolling and panning on touch events, while
			// attempting to slide. The tap event also depends on this.
			e.preventDefault();

			// Filter the event to register the type, which can be
			// touch, mouse or pointer. Offset changes need to be
			// made on an event specific basis.
			var  touch = e.type.indexOf('touch') === 0
				,mouse = e.type.indexOf('mouse') === 0
				,pointer = e.type.indexOf('pointer') === 0
				,x,y, event = e;

			// IE10 implemented pointer events with a prefix;
			if ( e.type.indexOf('MSPointer') === 0 ) {
				pointer = true;
			}

			// Get the originalEvent, if the event has been wrapped
			// by jQuery. Zepto doesn't wrap the event.
			if ( e.originalEvent ) {
				e = e.originalEvent;
			}

			if ( touch ) {
				// noUiSlider supports one movement at a time,
				// so we can select the first 'changedTouch'.
				x = e.changedTouches[0].pageX;
				y = e.changedTouches[0].pageY;
			}
			if ( mouse || pointer ) {

				// Polyfill the pageXOffset and pageYOffset
				// variables for IE7 and IE8;
				if( !pointer && window.pageXOffset === undefined ){
					window.pageXOffset = document.documentElement.scrollLeft;
					window.pageYOffset = document.documentElement.scrollTop;
				}

				x = e.clientX + window.pageXOffset;
				y = e.clientY + window.pageYOffset;
			}

			return $.extend( event, { pointX: x, pointY: y, cursor: mouse } );
		}

	// Handler for attaching events trough a proxy
		function attach ( events, target, callback, scope, noAbstraction ) {

			// Add the noUiSlider namespace to all events.
			events = events.replace( /\s/g, namespace + ' ' ) + namespace;

			// The 'noAbstraction' argument can be set to prevent
			// event checking, and instead just proxy the event to
			// the right namespace.
			if ( noAbstraction ) {
				return target.on( events,
					$.proxy( callback, $.extend(target, scope) ));
			}

			// Make the callback available in a lower scope
			scope.handler = callback;

			return target.on( events, $.proxy( function( e ){

				// Test if there is anything that should prevent an event
				// from being handled, such as a disabled state or an active
				// 'tap' transition. Prevent interaction with disabled sliders.
				if( this.target.hasClass('noUi-state-tap') ||
					this.target.attr('disabled')) {
						return false;
				}

				// Call the event handler with the original event as argument.
				// The handler won't know it has been passed trough this
				// proxy, and it won't have to filter event validity, because
				// that was done here. Since the scope can just be 'this',
				// there is no need to use .call().
				this.handler( fixEvent ( e ) );

			}, scope ));
		}


// Serialization and value storage

	// Store a value on all serialization targets, or get the current value.
		function serialize ( a ) {

			// Re-scope target for availability within .each;
			var target = this.target;

			// Get the value for this handle
			if ( a === undefined ) {
				return this.element.data('value');
			}

			// Write the value to all serialization objects
			// or store a new value on the handle
			if ( a === true ) {
				a = this.element.data('value');
			} else {
				this.element.data('value', a);
			}

			// If the provided element was a function,
			// call it with the slider as scope. Otherwise,
			// simply call the function on the object.
			$.each( this.elements, function() {
				if ( typeof this === 'function' ) {
					this.call(target, a);
				} else {
					this[0][this[1]](a);
				}
			});
		}

	// Map serialization to [ element, method ]. Attach events where required.
		function storeElement ( handle, item, number ) {

			// Add a change event to the supplied jQuery objects,
			// which triggers the value-setting function on the target.
			if ( isInstance( item ) ) {

				var elements = [];

				// Link the field to the other handle if the
				// slider is inverted.
				if ( handle.data('options').direction ) {
					number = number ? 0 : 1;
				}

				// Loop all items so the change event is properly bound,
				// and the items can individually be added to the array.
				item.each(function(){

					attach ( 'change', $(this), function(){

						// Determine the correct position to set,
						// leave the other one unchanged.
						var val = [null, null];
						val[this.which] = this.val();

						// Trigger the 'set' callback
						this.target.val(val, true);

					}, {
						 target: handle.data('target')
						,handle: handle
						,which: number
					}, true );

					elements.push ( [ $(this), 'val' ] );
				});

				return elements;
			}

			// Append a new input to the noUiSlider base.
			// Prevent the change event from flowing upward.
			if ( typeof item === 'string' ) {

				item = [ $('<input type="hidden" name="'+ item +'">')
					.appendTo(handle)
					.addClass(clsList[3])
					.change(function ( e ) {
						e.stopPropagation();
					}), 'val'];
			}

			return [item];
		}

	// Access point and abstraction for serialization.
		function store ( handle, i, serialization ) {

			var elements = [];

			// Loops all items in the provided serialization setting,
			// add the proper events to them or create new input fields,
			// and add them as data to the handle so they can be kept
			// in sync with the slider value.
			$.each( serialization.to[i], function( index ){
				elements = elements.concat(
					storeElement( handle, serialization.to[i][index], i )
				);
			});

			return {
				 element: handle
				,elements: elements
				,target: handle.data('target')
				,val: serialize
			};
		}


// Handle placement

	// Fire callback on unsuccessful handle movement.
		function block ( base, stateless ) {

			var target = base.data('target');

			if ( !target.hasClass(clsList[14]) ){

				// The visual effects should not always be applied.
				if ( !stateless ) {
					target.addClass(clsList[15]);
					setTimeout(function(){
						target.removeClass(clsList[15]);
					}, 600);
				}

				target.addClass(clsList[14]);
				call( base.data('options').block, target );
			}

			return false;
		}

	// Change inline style and apply proper classes.
		function placeHandle ( handle, to, handles ) {

			var settings = handle.data('options');

			// If the slider can move, remove the class
			// indicating the block state.
			handle.data('target').removeClass(clsList[14]);

			// Set handle to new location
			handle.css( settings.style, to + '%' ).data('pct', to);

			// Force proper handle stacking
			if ( handle[0] === handles[0][0] ) {
				handle.children('.' + clsList[2])
					.toggleClass(clsList[13], to > 50 );
			}

			if ( settings.direction ) {
				to = 100 - to;
			}

			// Write the value to the serialization object.
			handle.data('store').val(
				format ( isPercentage( settings.range, to ), settings )
			);
		}

	// Test suggested values and apply margin, step.
		function setHandle ( handle, to, noBlock ) {

			function zTh ( to ) {
				return to < 0 ? 0 : to > 100 ? 100 : to;
			}

			var  handles = handle.data('base').data('handles')
				,edge, initial = handle.data('pct')
				,step = handle.data('options').step
				,margin = handle.data('options').margin;

			// Catch any attempt to drag beyond the slider edges.
			to = zTh(to);

			// Catch invalid user input
			if ( !isNumeric( to ) || to === initial ) {
				return false;
			}

			// Handle the step option.
			if ( step ){
				to = closest( to, step );
			}

			// Stop handling this call if the handle
			// won't step to a new value.
			if ( to === initial ) {
				return false;
			}

			if ( handles.length > 1 ){

				// If there are multiple handles, they can't pass
				// each other, and they'll be limited to the other handle.
				if ( handle[0] === handles[1][0] ) {
					edge = handles[0].data('pct') + margin;
					to = to < edge ? edge : to;
				} else {
					edge = handles[1].data('pct') - margin;
					to = to > edge ? edge : to;
				}
			}

			// Limit 'to' to 0 - 100 again after all modifications
			to = zTh(to);

			// Stop handling this call if the handle can't move past another.
			if ( to === initial ) {
				return noBlock ? false : block( handle.data('base'), !margin );
			}

			placeHandle ( handle, to, handles );
			return true;
		}


// Event handlers

	// Handle movement on document for handle and range drag.
		function move ( event ) {

			// Map event movement to a slider percentage.
			var proposal = (function( xy, size, event, start ){
				return ( ( event[ xy ] - start[ xy ] ) * 100 ) / size;
			}( this.size[0], this.size[1], event, this.start ));

			if ( this.handles.length === 1 ) {

				// Run handle placement.
				if ( !setHandle( this.handles[0], this.pos[0] + proposal )){
					return;
				}

			} else {

				// Dragging the range could be implemented by forcing the
				// 'move' event on both handles, but this solution proved
				// lagging on slower devices, resulting in range errors. The
				// slightly ugly solution below is considerably faster.
				// Bypass the 'setHandle' method, since other checks are needed.

				var l1, u1, l2, u2;

				// Round the proposal to the step setting.
				if ( this.step ) {
					proposal = closest( proposal, this.step );
				}

				// Determine the new position, store it twice. Once for
				// limiting, once for checking whether placement should occur.
				l1 = l2 = this.pos[0] + proposal;
				u1 = u2 = this.pos[1] + proposal;

				// Round the values within a sensible range.
				if ( l1 < 0 ) {
					u1 += -1 * l1;
					l1 = 0;
				} else if ( u1 > 100 ) {
					l1 -= ( u1 - 100 );
					u1 = 100;
				}

				// Don't perform placement if no handles are to be changed.
				if ( ( !l2 && l1 ) || ( u1 > 100 && u2 === 100 ) ||
					 l1 !== l2 || u1 !== u2 ) {
					return;
				}

				placeHandle ( this.handles[0], l1, this.handles );
				placeHandle ( this.handles[1], u1, this.handles );
			}

			// Trigger the 'slide' event, if the handle was moved.
			call( this.base.data('options').slide, this.target );
		}

	// Unbind move events on document, call callbacks.
		function end ( event ) {

			// The handle is no longer active, so remove the class.
			if ( this.handle ) {
				this.handle.children('.' + clsList[2]).removeClass(clsList[4]);
			}

			if ( event.cursor ) {

				// Remove cursor styles and text-selection events
				// which are bound to the body.
				body.css('cursor', '').off( namespace );
			}

			// Unbind move and end events, to prevent them stacking
			// over and over.
			doc.off( namespace );

			// Trigger the change event.
			this.target.removeClass(clsList[14]).change();

			// Trigger the 'end' callback.
			call( this.options.set, this.target );
		}

	// Bind move events on document.
		function start ( event ) {

			var positions = [], i, settings = this.base.data('options');

			for ( i = 0; i < this.handles.length; i++ ) {
				positions.push(this.handles[i].data('pct'));
			}

			// Mark the handle as 'active' so it can be styled.
			if( this.handles.length === 1 ) {
				this.handles[0].children('.' + clsList[2]).addClass(clsList[4]);
			}

			// A drag should never propagate up to the 'tap' event.
			event.stopPropagation();

			// Attach the move event.
			attach ( actions.move, doc, move, {
				 start: event
				,base: this.base
				,target: this.target
				,handles: this.handles
				,pos: positions
				,step: settings.step
				,size: settings.orientation ?
					['pointY', this.base.height()] :
					['pointX', this.base.width()]

			});

			// Unbind all movement when the drag ends.
			attach ( actions.end, doc, end, {
				 base: this.base
				,target: this.target
				,options: settings
			});

			// Text selection isn't an issue on touch devices,
			// so adding additional callbacks isn't required.
			if ( event.cursor ) {

				// Prevent the 'I' cursor.
				body.css('cursor', 'default');

				// Prevent text selection when dragging the handles.
				body.on('selectstart' + namespace, function( ){
					return false;
				});
			}
		}

	// Move closest handle to tapped location.
		function tap ( event ) {

			// Determine the handle closest to the tap.
			function closestHandle ( handles, location, style ) {

				if ( handles.length === 1 ) {
					return handles[0];
				}

				var total = handles[0].offset()[style] +
							handles[1].offset()[style];

				return handles[ location < total / 2 ? 0 : 1 ];
			}

			// Getting variables from the event is not required, but
			// shortens other expressions and is far more convenient;
			var base = this.base, handle, to, point, size,
				style = base.data('options').style;

			if ( base.data('options').orientation ) {
				point = event.pointY;
				size = base.height();
			} else {
				point = event.pointX;
				size = base.width();
			}

			handle = closestHandle( base.data('handles'), point, style );
			to = (( point - base.offset()[ style ] ) * 100 ) / size;

			// Flag the slider as it is now in a transitional state.
			// Transition takes 300 ms, so re-enable the slider afterwards.
			base.addClass(clsList[5]);
			setTimeout(function(){
				base.removeClass(clsList[5]);
			}, 300);

			// Move the handle to the new position.
			setHandle( handle, to );

			// Trigger the 'slide' and 'set' callbacks,
			// pass the target so that it is 'this'.
			call( [ handle.data('options').slide
				   ,handle.data('options').set ], base.data('target') );

			base.data('target').change();
		}


// API

	// Validate and standardize input.
		function test ( input, sliders ){

		//	Every input option is tested and parsed. This'll prevent
		//	endless validation in internal methods. These tests are
		//	structured with an item for every option available. An
		//	option can be marked as required by setting the 'r' flag.
		//	The testing function is provided with three arguments:
		//		- The provided value for the option;
		//		- A reference to the options object;
		//		- The name for the option;
		//
		//	The testing function returns false when an error is detected,
		//	or true when everything is OK. It can also modify the option
		//	object, to make sure all values can be correctly looped elsewhere.

			var tests = {
				/*	Handles.
				 *	Has default, can be 1 or 2.
				 */
				 'handles': {
					 r: true
					,t: function(q){
						q = parseInt(q, 10);
						return ( q === 1 || q === 2 );
					}
				}
				/*	Range.
				 *	Must be an array of two numerical floats,
				 *	which can't be identical.
				 */
				,'range': {
					 r: true
					,t: function(q,o,w){

						if ( q.length !== 2 ){
							return false;
						}

						// Reset the array to floats
						q = [ parseFloat(q[0]), parseFloat(q[1]) ];

						// Test if those floats are numerical
						if( !isNumeric(q[0]) || !isNumeric(q[1]) ){
							return false;
						}

						// When this test is run for range, the values can't
						// be identical.
						if( w==='range' && q[0] === q[1] ){
							return false;
						}

						// The lowest value must really be the lowest value.
						if( q[1] < q[0] ){
							return false;
						}

						o[w] = q;
						return true;
					}
				 }
				/*	Start.
				 *	Must be an array of two numerical floats when handles = 2;
				 *	Uses 'range' test.
				 *	When handles = 1, a single float is also allowed.
				 */
				,'start': {
					 r: true
					,t: function(q,o,w){
						if( o.handles === 1 ){
							if( $.isArray(q) ){
								q = q[0];
							}
							q = parseFloat(q);
							o.start = [q];
							return isNumeric(q);
						}
						return tests.range.t(q,o,w);
					}
				}
				/*	Connect.
				 *	Must be true or false when handles = 2;
				 *	Can use 'lower' and 'upper' when handles = 1.
				 */
				,'connect': {
					 t: function(q,o){
							return o.handles === 1 ?
								( q === 'lower' || q === 'upper' ) :
								typeof q === 'boolean';
					 }
				}
				/*	Connect.
				 *	Will default to horizontal, not required.
				 */
				,'orientation': {
					 t: function(q,o,w){
						switch (q){
							case 'horizontal':
								o[w] = 0;
								break;
							case 'vertical':
								o[w] = 1;
								break;
							default: return false;
						}
						return true;
					}
				}
				/*	Margin.
				 *	Must be a float, has a default value.
				 */
				,'margin': {
					 r: true
					,t: function(q,o,w){
						q = parseFloat(q);
						o[w] = fromPercentage(o.range, q);
						return isNumeric(q);
					}
				}
				/*	Direction.
				 *	Required, can be 'ltr' or 'rtl'.
				 */
				,'direction': {
					 r: true
					,t: function(q,o,w){
						switch ( q ) {
							case 'ltr': o[w] = 0; break;
							case 'rtl': o[w] = 1; break;
							default: return false;
						}
						return true;
					}
				}
				/*	Behaviour.
				 *	Required, defines responses to tapping and
				 *	dragging elements.
				 */
				,'behaviour': {
					 r: true
					,t: function(q,o,w){

						o[w] = {
							 tap: false
							,drag: false
							,move: true
						};

						if ( o.handles === 1 &&
							( q !== 'tap' && q !== 'none' ) ) {
							return false;
						}

						switch (q) {
							case 'tap-drag':
								o[w].drag = true;
							case 'tap':
								o[w].tap = true;
							break;
							case 'drag-fixed':
								o[w].move = false;
							case 'drag':
								o[w].drag = true;
							break;
							case 'none': break;
							default:
								return false;
						}

						return true;
					}
				}
				/*	Serialization.
				 *	Required, but has default. 'resolution' and 'mark' option,
				 *	are allowed to be missing, 'to' isn't. Must be an array
				 *	when using two handles, can be a single value
				 *	when using one handle. 'mark' can only be period (.) or
				 *	comma (,) to make sure the value can be parsed properly.
				 */
				,'serialization': {
					 r: true
					,t: function(q,o,w){

						// Checks whether a variable is a candidate to be a
						// valid serialization target.
						function ser(r){
							return isInstance ( r )
								|| typeof r === 'string'
								|| typeof r === 'function'
								|| r === false
								|| ( isInstance ( r[0] ) &&
									 typeof r[0][r[1]] === 'function' );
						}

						// Flatten the serialization array into a reliable
						// set of elements, which can be tested and looped.
						function filter ( value ) {

							var items = [[],[]];

							// If a single value is provided it can be pushed
							// immediately.
							if ( ser(value) ) {
								items[0].push(value);
							} else {

								// Otherwise, determine whether this is an
								// array of single elements or sets.
								$.each(value, function(i, val) {

									// Don't handle an overflow of elements.
									if( i > 1 ){
										return;
									}

									// Decide if this is a group or not
									if( ser(val) ){
										items[i].push(val);
									} else {
										items[i] = items[i].concat(val);
									}
								});
							}

							return items;
						}

						if ( !q.to ) {
							o[w].to = [[],[]];
						} else {

							var i, j;

							// Flatten the serialization array
							q.to = filter ( q.to, 0 );

							// Reverse the API for RTL sliders.
							if ( o.direction && q.to[1].length ) {
								q.to.reverse();
							}

							// Test all elements in the flattened array.
							for ( i = 0; i < o.handles; i++ ) {
								for ( j = 0; j < q.to[i].length; j++ ) {

									// Return false on invalid input
									if( !ser(q.to[i][j]) ){
										return false;
									}

									// Remove 'false' elements, since those
									// won't be handled anyway.
									if( !q.to[i][j] ){
										q.to[i].splice(j, 1);
									}
								}
							}

							// Write the new values back
							o[w].to = q.to;
						}

						if ( !q.resolution ){
							o[w].resolution = 0.01;
						} else {
							switch(q.resolution){
								case 1:
								case 0.1:
								case 0.01:
								case 0.001:
								case 0.0001:
								case 0.00001:
									break;
								default:
									return false;
							}
						}

						if ( !q.mark ){
							o[w].mark = '.';
						} else if ( q.mark !== '.' && q.mark !== ',' ) {
							return false;
						}

						return true;
					}
				}
				/*	Slide.
				 *	Not required. Must be a function.
				 */
				,'slide': {
					 t: function(q){
						return typeof q === 'function';
					}
				}
				/*	Set.
				 *	Not required. Must be a function.
				 *	Tested using the 'slide' test.
				 */
				,'set': {
					 t: function(q,o){
						return tests.slide.t(q,o);
					}
				}
				/*	Block.
				 *	Not required. Must be a function.
				 *	Tested using the 'slide' test.
				 */
				,'block': {
					 t: function(q,o){
						return tests.slide.t(q,o);
					}
				}
				/*	Step.
				 *	Not required.
				 */
				,'step': {
					 t: function(q,o,w){
						q = parseFloat(q);
						o[w] = fromPercentage ( o.range, q );
						return isNumeric(q);
					}
				}
			};

			$.each( tests, function( name, test ){

				var value = input[name], isSet = ( value || value === 0 );

				// If the value is required but not set, fail.
				if( ( test.r && !isSet ) ||
				// If the test returns false, fail.
					( isSet && !test.t( value, input, name ) ) ){

					// For debugging purposes it might be very useful to know
					// what option caused the trouble. Since throwing an error
					// will prevent further script execution, log the error
					// first. Test for console, as it might not be available.
					if( console && console.log && console.group ){
						console.group( 'Invalid noUiSlider initialisation:' );
						console.log( 'Option:\t', name );
						console.log( 'Value:\t', value );
						console.log( 'Slider(s):\t', sliders );
						console.groupEnd();
					}

					throw new RangeError('noUiSlider');
				}
			});
		}

	// Parse options, add classes, attach events, create HTML.
		function create ( options ) {

			// Store the original set of options on all targets,
			// so they can be re-used and re-tested later.
			// Make sure to break the relation with the options,
			// which will be changed by the 'test' function.
			this.data('options', $.extend(true, {}, options));

			// Set defaults where applicable;
			options = $.extend({
				 handles: 2
				,margin: 0
				,direction: 'ltr'
				,behaviour: 'tap'
				,orientation: 'horizontal'
			}, options);

			// Make sure the test for serialization runs.
			options.serialization = options.serialization || {};

			// Run all options through a testing mechanism to ensure correct
			// input. The test function will throw errors, so there is
			// no need to capture the result of this call. It should be noted
			// that options might get modified to be handled properly. E.g.
			// wrapping integers in arrays.
			test( options, this );

			// Pre-define the styles.
			options.style = options.orientation ? 'top' : 'left';

			return this.each(function(){

				// Target is the wrapper that will receive all external
				// scripting interaction. It has no styling and serves no
				// other function. Base is the internal main 'bar'.
				var target = $(this).addClass(clsList[6]), i, handle,
					base = $('<div/>').appendTo(target), dragable, handles = [],
					classes = {
						 base: [ clsList[0] ]
						,origin: [
							 [ clsList[1]
							  ,clsList[1] + clsList[options.direction?8:7] ]
							,[ clsList[1]
							  ,clsList[1] + clsList[options.direction?7:8] ]
						]
						,handle: [
							 [ clsList[2]
							  ,clsList[2] + clsList[options.direction?8:7] ]
							,[ clsList[2]
							  ,clsList[2] + clsList[options.direction?7:8] ]
						]
					};

				// Throw an error if the slider was already initialized.
				if ( target.data('base') ) {
					throw new Error('Slider was already initialized.');
				}

				// Apply the required connection classes to the elements
				// that need them. Some classes are made up for several
				// segments listed in the class list, to allow easy
				// renaming and provide a minor compression benefit.
				if( options.connect ) {

					if ( options.direction ) {
						if ( options.connect === 'lower' ) {
							options.connect = 'upper';
						} else if ( options.connect === 'upper' ) {
							options.connect = 'lower';
						}
					}

					if( options.connect === 'lower' ){
						// Add some styling classes to the base;
						classes.base.push(clsList[9], clsList[9] + clsList[7]);
						// When using the option 'Lower', there is only one
						// handle, and thus only one origin.
						classes.origin[0].push(clsList[12]);
					} else {
						classes.base.push(clsList[9] + clsList[8], clsList[12]);
						classes.origin[0].push(clsList[9]);
					}

				} else {
					classes.base.push(clsList[12]);
				}

				// Parse the syntactic sugar that is the serialization
				// resolution option to a usable integer.
				// Checking for a string '1', since the resolution needs
				// to be cast to a string to split in on the period.
				options.decimals = (function(d){
					d = d.toString().split('.');
					return d[0] === '1' ? 0 : d[1].length;
				}( options.serialization.resolution ));

				// Add classes for horizontal and vertical sliders.
				// The horizontal class is provided for completeness,
				// as it isn't used in the default theme.
				if ( options.orientation ){
					classes.base.push(clsList[10]);
				} else {
					classes.base.push(clsList[11]);
				}

				// Set as little as possible data on the
				// public facing target element.
				target.data('base', base);

				if ( options.direction ) {
					base.addClass(clsList[16]);
				}

				for (i = 0; i < options.handles; i++ ) {

					handle = $('<div><div/></div>').appendTo(base);

					// Add all default and option-specific classes to the
					// origins and handles.
					handle.addClass(classes.origin[i].join(' '));
					handle.children().addClass(classes.handle[i].join(' '));

					// Make sure every handle has access to all variables.
					handle.data({
						 base: base
						,target: target
						,options: options
					}).attr('data-style', options.style);

					// Every handle has a storage point, which takes care
					// of triggering the proper serialization callbacks.
					handle.data({
						store: store(handle, i, options.serialization)
					});

					// Store handles on the base
					handles.push(handle);
				}

				// Merge base classes with default,
				// and store relevant data on the base element.
				base.addClass( classes.base.join(' ') ).data({
					 target: target
					,options: options
					,handles: handles
				});

				// Use the public value method to set the start values.
				target.val( options.start );

				// Attach the standard drag event to the handles.
				if ( options.behaviour.move ) {
					for ( i = 0; i < handles.length; i++ ) {

						// These events are only bound to the visual handle
						// element, not the 'real' origin element.
						attach ( actions.start, handles[i].children(), start, {
							 base: base
							,target: target
							,handles: [ handles[i] ]
						});
					}
				}

				// Attach the tap event to the slider base.
				if ( options.behaviour.tap ) {
					attach ( actions.start, base, tap, {
						 base: base
						,target: target
					});
				}

				// Make the range dragable.
				if ( options.behaviour.drag ){

					dragable = base.find( '.' + clsList[9] )
						.addClass( clsList[17] );

					// When the range is fixed, the entire range can
					// be dragged by the handles. The handle in the first
					// origin will propagate the start event upward,
					// but it needs to be bound manually on the other.
					if ( !options.behaviour.move ) {
						dragable = dragable.add( base.children()
							.not(dragable)
							.children('.' + clsList[2]) );
					}

					attach ( actions.start, dragable, start, {
						 base: base
						,target: target
						,handles: handles
					});
				}
			});
		}

	// Return value for the slider, relative to 'range'.
		function getValue ( ) {

			var base = $(this).data('base'), answer = [];

			// Loop the handles, and get the value from the input
			// for every handle on its' own.
			$.each( base.data('handles'), function(){
				answer.push( $(this).data('store').val() );
			});

			// If the slider has just one handle, return a single value.
			// Otherwise, return an array, which is in reverse order
			// if the slider is used RTL.
			if ( answer.length === 1 ) {
				return answer[0];
			}

			if ( base.data('options').direction ) {
				return answer.reverse();
			}

			return answer;
		}

	// Set value for the slider, relative to 'range'.
		function setValue ( args, set ) {

			// If the value is to be set to a number, which is valid
			// when using a one-handle slider, wrap it in an array.
			if( !$.isArray(args) ){
				args = [args];
			}

			// Setting is handled properly for each slider in the data set.
			return this.each(function(){

				var handles = Array.prototype.slice.call(
								$(this).data('base').data('handles'), 0),
					settings = handles[0].data('options'), to, i;

				// If there are multiple handles to be set run the setting
				// mechanism twice for the first handle, to make sure it
				// can be bounced of the second one properly.
				if ( handles.length > 1) {
					handles[2] = handles[0];
				}

				// The RTL settings is implemented by reversing the front-end,
				// internal mechanisms are the same.
				if ( settings.direction ) {
					args.reverse();
				}

				for ( i = 0; i < handles.length; i++ ){

					// Calculate a new position for the handle.
					to = args[ i%2 ];

					// The set request might want to ignore this handle.
					// Test for 'undefined' too, as a two-handle slider
					// can still be set with an integer.
					if( to === null || to === undefined ) {
						continue;
					}

					// Add support for the comma (,) as a decimal symbol.
					// Replace it by a period so it is handled properly by
					// parseFloat. Omitting this would result in a removal
					// of decimals. This way, the developer can also
					// input a comma separated string.
					if( $.type(to) === 'string' ) {
						to = to.replace(',', '.');
					}

					// Calculate the new handle position
					to = toPercentage( settings.range, parseFloat( to ) );

					// Invert the value if this is an right-to-left slider.
					if ( settings.direction ) {
						to = 100 - to;
					}

					// If the value of the input doesn't match the slider,
					// reset it. Sometimes the input is changed to a value the
					// slider has rejected. This can occur when using 'select'
					// or 'input[type="number"]' elements. In this case, set
					// the value back to the input.
					if ( !setHandle( handles[i], to, true ) ){
						handles[i].data('store').val( true );
					}

					// Optionally trigger the 'set' event.
					if( set === true ) {
						call( settings.set, $(this) );
					}
				}
			});
		}

	// Unbind all attached events, remove classed and HTML.
		function destroy ( target ) {

			var elements = [];

			// Get the fields bound to both handles.
			$.each(target.data('base').data('handles'), function(){
				elements = elements.concat( $(this).data('store').elements );
			});

			// Remove all events added by noUiSlider.
			$.each(elements, function(){
				$(this)[0].off( namespace );
			});

			// Remove all data from the target and empty it.
			target.removeClass(clsList[6]).empty().removeData('base options');
		}

	// Merge options with current initialization, destroy slider
	// and reinitialize.
		function build ( options ) {

			return this.each(function(){

				// When uninitialised, jQuery will return '',
				// Zepto returns undefined. Both are falsy.
				var values = $(this).val() || false,
					current = $(this).data('options'),
				// Extend the current setup with the new options.
					setup = $.extend( {}, current, options );

				// If there was a slider initialised, remove it first.
				if ( values !== false ) {
					destroy( $(this) );
				}

				// Make the destroy method publicly accessible.
				if( !options ) {
					return;
				}

				// Create a new slider
				$(this).noUiSlider( setup );

				// Set the slider values back. If the start options changed,
				// it gets precedence.
				if ( values !== false && setup.start === current.start ) {
					$(this).val( values );
				}
			});
		}



	// Overwrite the native jQuery value function
	// with a simple handler. noUiSlider will use the internal
	// value method, anything else will use the standard method.
		$.fn.val = function(){

			// If the function is called without arguments,
			// act as a 'getter'. Call the getValue function
			// in the same scope as this call.
			if ( this.hasClass( clsList[6] ) ){
				return arguments.length ?
					setValue.apply( this, arguments ) :
					getValue.apply( this );
			}

			// If this isn't noUiSlider, continue with jQuery's
			// original method.
			return $VAL.apply( this, arguments );
		};

		return ( rebuild ? build : create ).call( this, options );
	};

}( window.jQuery || window.Zepto ));
