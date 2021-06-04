
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.35.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.35.0 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let body;
    	let div5;
    	let div4;
    	let div3;
    	let div2;
    	let div1;
    	let h1;
    	let a0;
    	let t1;
    	let p0;
    	let t3;
    	let div0;
    	let ul0;
    	let li0;
    	let a1;
    	let span0;
    	let t4;
    	let li1;
    	let a2;
    	let span1;
    	let t5;
    	let li2;
    	let a3;
    	let span2;
    	let t6;
    	let a4;
    	let t8;
    	let header;
    	let div6;
    	let h40;
    	let t10;
    	let ul2;
    	let li10;
    	let input0;
    	let t11;
    	let label0;
    	let span3;
    	let t12;
    	let ul1;
    	let li3;
    	let a5;
    	let t14;
    	let li4;
    	let a6;
    	let t16;
    	let li5;
    	let a7;
    	let t18;
    	let li6;
    	let a8;
    	let t20;
    	let li7;
    	let a9;
    	let t22;
    	let li8;
    	let a10;
    	let t24;
    	let li9;
    	let a11;
    	let t26;
    	let section0;
    	let div10;
    	let h30;
    	let t28;
    	let div9;
    	let div7;
    	let img0;
    	let img0_src_value;
    	let t29;
    	let div8;
    	let h41;
    	let t30;
    	let br;
    	let t31;
    	let t32;
    	let p1;
    	let t34;
    	let p2;
    	let em0;
    	let t36;
    	let p3;
    	let t37;
    	let p4;
    	let t39;
    	let p5;
    	let t41;
    	let div17;
    	let div16;
    	let div15;
    	let div11;
    	let span4;
    	let t42;
    	let h42;
    	let t44;
    	let div12;
    	let span5;
    	let t45;
    	let h43;
    	let t47;
    	let div13;
    	let span6;
    	let t48;
    	let h44;
    	let t50;
    	let div14;
    	let span7;
    	let t51;
    	let h45;
    	let t53;
    	let div24;
    	let div23;
    	let div22;
    	let div18;
    	let p6;
    	let t55;
    	let p7;
    	let t57;
    	let div19;
    	let p8;
    	let t59;
    	let p9;
    	let t61;
    	let div20;
    	let p10;
    	let t63;
    	let p11;
    	let t65;
    	let div21;
    	let p12;
    	let t67;
    	let p13;
    	let t69;
    	let div58;
    	let div57;
    	let h31;
    	let t71;
    	let div40;
    	let div29;
    	let div28;
    	let div27;
    	let div26;
    	let div25;
    	let span8;
    	let t72;
    	let h32;
    	let t74;
    	let p14;
    	let t76;
    	let div34;
    	let div33;
    	let div32;
    	let div31;
    	let div30;
    	let span9;
    	let t77;
    	let h33;
    	let t79;
    	let p15;
    	let t81;
    	let div39;
    	let div38;
    	let div37;
    	let div36;
    	let div35;
    	let span10;
    	let t82;
    	let h34;
    	let t84;
    	let p16;
    	let t86;
    	let div56;
    	let div45;
    	let div44;
    	let div43;
    	let div42;
    	let div41;
    	let span11;
    	let t87;
    	let h35;
    	let t89;
    	let p17;
    	let t91;
    	let div50;
    	let div49;
    	let div48;
    	let div47;
    	let div46;
    	let span12;
    	let t92;
    	let h36;
    	let t94;
    	let p18;
    	let t96;
    	let div55;
    	let div54;
    	let div53;
    	let div52;
    	let div51;
    	let span13;
    	let t97;
    	let h37;
    	let t99;
    	let p19;
    	let t101;
    	let div69;
    	let div68;
    	let h38;
    	let t103;
    	let div67;
    	let div59;
    	let img1;
    	let img1_src_value;
    	let t104;
    	let div66;
    	let input1;
    	let t105;
    	let label1;
    	let span14;
    	let t106;
    	let t107;
    	let input2;
    	let t108;
    	let label2;
    	let span15;
    	let t109;
    	let t110;
    	let section1;
    	let div60;
    	let h46;
    	let t112;
    	let h60;
    	let t114;
    	let p20;
    	let t116;
    	let div61;
    	let h47;
    	let t118;
    	let h61;
    	let t120;
    	let p21;
    	let t122;
    	let div62;
    	let h48;
    	let t124;
    	let h62;
    	let t126;
    	let p22;
    	let t128;
    	let p23;
    	let t129;
    	let section2;
    	let div63;
    	let h49;
    	let t131;
    	let h63;
    	let t133;
    	let p24;
    	let t135;
    	let p25;
    	let t137;
    	let div64;
    	let h410;
    	let t139;
    	let h64;
    	let t141;
    	let p26;
    	let t143;
    	let div65;
    	let h411;
    	let t145;
    	let h65;
    	let t147;
    	let p27;
    	let t149;
    	let section3;
    	let div71;
    	let div70;
    	let h39;
    	let t151;
    	let div78;
    	let div77;
    	let h310;
    	let t153;
    	let div76;
    	let div75;
    	let div72;
    	let a12;
    	let img2;
    	let img2_src_value;
    	let t154;
    	let a13;
    	let img3;
    	let img3_src_value;
    	let t155;
    	let div73;
    	let a14;
    	let img4;
    	let img4_src_value;
    	let t156;
    	let a15;
    	let img5;
    	let img5_src_value;
    	let t157;
    	let div74;
    	let a16;
    	let img6;
    	let img6_src_value;
    	let t158;
    	let a17;
    	let img7;
    	let img7_src_value;
    	let t159;
    	let div80;
    	let div79;
    	let img8;
    	let img8_src_value;
    	let t160;
    	let p28;
    	let t162;
    	let a18;
    	let t164;
    	let div82;
    	let div81;
    	let img9;
    	let img9_src_value;
    	let t165;
    	let p29;
    	let t167;
    	let p30;
    	let t168;
    	let a19;
    	let t170;
    	let a20;
    	let t172;
    	let div84;
    	let div83;
    	let img10;
    	let img10_src_value;
    	let t173;
    	let p31;
    	let t175;
    	let a21;
    	let t177;
    	let div86;
    	let div85;
    	let img11;
    	let img11_src_value;
    	let t178;
    	let p32;
    	let t180;
    	let a22;
    	let t182;
    	let div88;
    	let div87;
    	let img12;
    	let img12_src_value;
    	let t183;
    	let p33;
    	let t185;
    	let a23;
    	let t187;
    	let div90;
    	let div89;
    	let img13;
    	let img13_src_value;
    	let t188;
    	let p34;
    	let t190;
    	let a24;
    	let t192;
    	let footer;
    	let div94;
    	let div91;
    	let h2;
    	let a25;
    	let t193;
    	let em1;
    	let t195;
    	let t196;
    	let p35;
    	let t198;
    	let p36;
    	let t200;
    	let div92;
    	let h311;
    	let t202;
    	let ul3;
    	let li11;
    	let a26;
    	let span16;
    	let t203;
    	let li12;
    	let a27;
    	let span17;
    	let t204;
    	let li13;
    	let a28;
    	let span18;
    	let t205;
    	let div93;
    	let p37;
    	let t206;
    	let a29;
    	let t208;
    	let a30;

    	const block = {
    		c: function create() {
    			body = element("body");
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			h1 = element("h1");
    			a0 = element("a");
    			a0.textContent = "Dustin Walker";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Moin Moin";
    			t3 = space();
    			div0 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			a1 = element("a");
    			span0 = element("span");
    			t4 = space();
    			li1 = element("li");
    			a2 = element("a");
    			span1 = element("span");
    			t5 = space();
    			li2 = element("li");
    			a3 = element("a");
    			span2 = element("span");
    			t6 = space();
    			a4 = element("a");
    			a4.textContent = "Read More";
    			t8 = space();
    			header = element("header");
    			div6 = element("div");
    			h40 = element("h4");
    			h40.textContent = "My Profile";
    			t10 = space();
    			ul2 = element("ul");
    			li10 = element("li");
    			input0 = element("input");
    			t11 = space();
    			label0 = element("label");
    			span3 = element("span");
    			t12 = space();
    			ul1 = element("ul");
    			li3 = element("li");
    			a5 = element("a");
    			a5.textContent = "Home";
    			t14 = space();
    			li4 = element("li");
    			a6 = element("a");
    			a6.textContent = "My Self";
    			t16 = space();
    			li5 = element("li");
    			a7 = element("a");
    			a7.textContent = "What i do ?";
    			t18 = space();
    			li6 = element("li");
    			a8 = element("a");
    			a8.textContent = "My Resume";
    			t20 = space();
    			li7 = element("li");
    			a9 = element("a");
    			a9.textContent = "Projects";
    			t22 = space();
    			li8 = element("li");
    			a10 = element("a");
    			a10.textContent = "Blog";
    			t24 = space();
    			li9 = element("li");
    			a11 = element("a");
    			a11.textContent = "Hire Me";
    			t26 = space();
    			section0 = element("section");
    			div10 = element("div");
    			h30 = element("h3");
    			h30.textContent = "About Myself";
    			t28 = space();
    			div9 = element("div");
    			div7 = element("div");
    			img0 = element("img");
    			t29 = space();
    			div8 = element("div");
    			h41 = element("h4");
    			t30 = text("Hi !");
    			br = element("br");
    			t31 = text("I'm Dustin Walker");
    			t32 = space();
    			p1 = element("p");
    			p1.textContent = "I am an ENGINEER";
    			t34 = space();
    			p2 = element("p");
    			em0 = element("em");
    			em0.textContent = "curious, resourceful, inventive, creative";
    			t36 = space();
    			p3 = element("p");
    			t37 = space();
    			p4 = element("p");
    			p4.textContent = "I enjoy creating things, that ease my, or the life of others, creations that improve the World, even by a tiny bit.\r\n\t\t\t\t\t\tI like making things that have never been done before. I always strive to find out the truth";
    			t39 = space();
    			p5 = element("p");
    			p5.textContent = "I excel a finding easy solutions for complex problems.";
    			t41 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div15 = element("div");
    			div11 = element("div");
    			span4 = element("span");
    			t42 = space();
    			h42 = element("h4");
    			h42.textContent = "Innovative Ideas";
    			t44 = space();
    			div12 = element("div");
    			span5 = element("span");
    			t45 = space();
    			h43 = element("h4");
    			h43.textContent = "Science";
    			t47 = space();
    			div13 = element("div");
    			span6 = element("span");
    			t48 = space();
    			h44 = element("h4");
    			h44.textContent = "Creation";
    			t50 = space();
    			div14 = element("div");
    			span7 = element("span");
    			t51 = space();
    			h45 = element("h4");
    			h45.textContent = "Solution";
    			t53 = space();
    			div24 = element("div");
    			div23 = element("div");
    			div22 = element("div");
    			div18 = element("div");
    			p6 = element("p");
    			p6.textContent = "800";
    			t55 = space();
    			p7 = element("p");
    			p7.textContent = "cups of coffee";
    			t57 = space();
    			div19 = element("div");
    			p8 = element("p");
    			p8.textContent = "400 000";
    			t59 = space();
    			p9 = element("p");
    			p9.textContent = "colleagues";
    			t61 = space();
    			div20 = element("div");
    			p10 = element("p");
    			p10.textContent = "4";
    			t63 = space();
    			p11 = element("p");
    			p11.textContent = "categories";
    			t65 = space();
    			div21 = element("div");
    			p12 = element("p");
    			p12.textContent = "55";
    			t67 = space();
    			p13 = element("p");
    			p13.textContent = "kg Pullup";
    			t69 = space();
    			div58 = element("div");
    			div57 = element("div");
    			h31 = element("h3");
    			h31.textContent = "What i do ?";
    			t71 = space();
    			div40 = element("div");
    			div29 = element("div");
    			div28 = element("div");
    			div27 = element("div");
    			div26 = element("div");
    			div25 = element("div");
    			span8 = element("span");
    			t72 = space();
    			h32 = element("h3");
    			h32.textContent = "Solve Problems";
    			t74 = space();
    			p14 = element("p");
    			p14.textContent = "The easiest way possible";
    			t76 = space();
    			div34 = element("div");
    			div33 = element("div");
    			div32 = element("div");
    			div31 = element("div");
    			div30 = element("div");
    			span9 = element("span");
    			t77 = space();
    			h33 = element("h3");
    			h33.textContent = "Build Prototypes";
    			t79 = space();
    			p15 = element("p");
    			p15.textContent = "With my vast amount of building skills";
    			t81 = space();
    			div39 = element("div");
    			div38 = element("div");
    			div37 = element("div");
    			div36 = element("div");
    			div35 = element("div");
    			span10 = element("span");
    			t82 = space();
    			h34 = element("h3");
    			h34.textContent = "Analyse Information";
    			t84 = space();
    			p16 = element("p");
    			p16.textContent = "And understand it thoroughly";
    			t86 = space();
    			div56 = element("div");
    			div45 = element("div");
    			div44 = element("div");
    			div43 = element("div");
    			div42 = element("div");
    			div41 = element("div");
    			span11 = element("span");
    			t87 = space();
    			h35 = element("h3");
    			h35.textContent = "Software";
    			t89 = space();
    			p17 = element("p");
    			p17.textContent = "create all kinds of stuff with good enough style and basic programming principles";
    			t91 = space();
    			div50 = element("div");
    			div49 = element("div");
    			div48 = element("div");
    			div47 = element("div");
    			div46 = element("div");
    			span12 = element("span");
    			t92 = space();
    			h36 = element("h3");
    			h36.textContent = "Ask Questions";
    			t94 = space();
    			p18 = element("p");
    			p18.textContent = "Because asking the right Questions is more important, then finding the right answer";
    			t96 = space();
    			div55 = element("div");
    			div54 = element("div");
    			div53 = element("div");
    			div52 = element("div");
    			div51 = element("div");
    			span13 = element("span");
    			t97 = space();
    			h37 = element("h3");
    			h37.textContent = "Umberella";
    			t99 = space();
    			p19 = element("p");
    			p19.textContent = "You can stand under my umbrella, ella, ella, eh, eh, eh, eh-eh";
    			t101 = space();
    			div69 = element("div");
    			div68 = element("div");
    			h38 = element("h3");
    			h38.textContent = "My Resume";
    			t103 = space();
    			div67 = element("div");
    			div59 = element("div");
    			img1 = element("img");
    			t104 = space();
    			div66 = element("div");
    			input1 = element("input");
    			t105 = space();
    			label1 = element("label");
    			span14 = element("span");
    			t106 = text("Education");
    			t107 = space();
    			input2 = element("input");
    			t108 = space();
    			label2 = element("label");
    			span15 = element("span");
    			t109 = text("Experience");
    			t110 = space();
    			section1 = element("section");
    			div60 = element("div");
    			h46 = element("h4");
    			h46.textContent = "Bachelor of Engineering";
    			t112 = space();
    			h60 = element("h6");
    			h60.textContent = "- Reutlingen University- 2021";
    			t114 = space();
    			p20 = element("p");
    			p20.textContent = "Speciallized in Automation, wich was mostly Computer Science though.";
    			t116 = space();
    			div61 = element("div");
    			h47 = element("h4");
    			h47.textContent = "Are you actually reading";
    			t118 = space();
    			h61 = element("h6");
    			h61.textContent = "- 2020-2020";
    			t120 = space();
    			p21 = element("p");
    			p21.textContent = "If you are reading this because I have applied for a job, you are offering\r\n\t\t\t\t\t\t\t\tplease tell me! Code: \tWalrus!\r\n\t\t\t\t\t\t\t\tWhy Walrus? Well ask me in the Interview, you are inviting me in...";
    			t122 = space();
    			div62 = element("div");
    			h48 = element("h4");
    			h48.textContent = "Aprenticeship Mechatronik";
    			t124 = space();
    			h62 = element("h6");
    			h62.textContent = "- Robert Bosch GmbH Reutlingen- 2018";
    			t126 = space();
    			p22 = element("p");
    			p22.textContent = "Done in two years instead of 3.5";
    			t128 = space();
    			p23 = element("p");
    			t129 = space();
    			section2 = element("section");
    			div63 = element("div");
    			h49 = element("h4");
    			h49.textContent = "various Personal Projekts";
    			t131 = space();
    			h63 = element("h6");
    			h63.textContent = "- 2016-forever";
    			t133 = space();
    			p24 = element("p");
    			p24.textContent = "check out my Github for more info";
    			t135 = space();
    			p25 = element("p");
    			p25.textContent = "I have built my own electrical Desk with off the shelf Parts (Pictures on instagram)";
    			t137 = space();
    			div64 = element("div");
    			h410 = element("h4");
    			h410.textContent = "Bachelorthesis";
    			t139 = space();
    			h64 = element("h6");
    			h64.textContent = "- 2020-2021 at BOSCH Power Tools Leinfelden (PT-BI/PXF2)";
    			t141 = space();
    			p26 = element("p");
    			p26.textContent = "Designing a High Frequency bidirectional ISolation Circuit";
    			t143 = space();
    			div65 = element("div");
    			h411 = element("h4");
    			h411.textContent = "Praxissemester";
    			t145 = space();
    			h65 = element("h6");
    			h65.textContent = "- 2018-2020 at BOSCH Power Tools Leinfelden (PT-MT/PXN)";
    			t147 = space();
    			p27 = element("p");
    			p27.textContent = "Prototyping, designing, programming, testing. Improving Panorama stitching with Machine Learning";
    			t149 = space();
    			section3 = element("section");
    			div71 = element("div");
    			div70 = element("div");
    			h39 = element("h3");
    			h39.textContent = "Invite me to the Job-Interview to learn more about me";
    			t151 = space();
    			div78 = element("div");
    			div77 = element("div");
    			h310 = element("h3");
    			h310.textContent = "Recent Projects";
    			t153 = space();
    			div76 = element("div");
    			div75 = element("div");
    			div72 = element("div");
    			a12 = element("a");
    			img2 = element("img");
    			t154 = space();
    			a13 = element("a");
    			img3 = element("img");
    			t155 = space();
    			div73 = element("div");
    			a14 = element("a");
    			img4 = element("img");
    			t156 = space();
    			a15 = element("a");
    			img5 = element("img");
    			t157 = space();
    			div74 = element("div");
    			a16 = element("a");
    			img6 = element("img");
    			t158 = space();
    			a17 = element("a");
    			img7 = element("img");
    			t159 = space();
    			div80 = element("div");
    			div79 = element("div");
    			img8 = element("img");
    			t160 = space();
    			p28 = element("p");
    			p28.textContent = "Nulla viverra pharetra se, eget pulvinar neque pharetra ac int. placerat placerat dolor.";
    			t162 = space();
    			a18 = element("a");
    			a18.textContent = "×";
    			t164 = space();
    			div82 = element("div");
    			div81 = element("div");
    			img9 = element("img");
    			t165 = space();
    			p29 = element("p");
    			p29.textContent = "Vergleich-von-Messmethoden-fuer-Punktwolken (simulation with python)";
    			t167 = space();
    			p30 = element("p");
    			t168 = text("Check it out:  ");
    			a19 = element("a");
    			a19.textContent = "www.kaggle.com";
    			t170 = space();
    			a20 = element("a");
    			a20.textContent = "×";
    			t172 = space();
    			div84 = element("div");
    			div83 = element("div");
    			img10 = element("img");
    			t173 = space();
    			p31 = element("p");
    			p31.textContent = "Nulla viverra pharetra se, eget pulvinar neque pharetra ac int. placerat placerat dolor.";
    			t175 = space();
    			a21 = element("a");
    			a21.textContent = "×";
    			t177 = space();
    			div86 = element("div");
    			div85 = element("div");
    			img11 = element("img");
    			t178 = space();
    			p32 = element("p");
    			p32.textContent = "DIY Electrical Desk with fancy LED Lamp";
    			t180 = space();
    			a22 = element("a");
    			a22.textContent = "×";
    			t182 = space();
    			div88 = element("div");
    			div87 = element("div");
    			img12 = element("img");
    			t183 = space();
    			p33 = element("p");
    			p33.textContent = "Nulla viverra pharetra se, eget pulvinar neque pharetra ac int. placerat placerat dolor.";
    			t185 = space();
    			a23 = element("a");
    			a23.textContent = "×";
    			t187 = space();
    			div90 = element("div");
    			div89 = element("div");
    			img13 = element("img");
    			t188 = space();
    			p34 = element("p");
    			p34.textContent = "Nulla viverra pharetra se, eget pulvinar neque pharetra ac int. placerat placerat dolor.";
    			t190 = space();
    			a24 = element("a");
    			a24.textContent = "×";
    			t192 = space();
    			footer = element("footer");
    			div94 = element("div");
    			div91 = element("div");
    			h2 = element("h2");
    			a25 = element("a");
    			t193 = text("this was DUSTINs ");
    			em1 = element("em");
    			em1.textContent = "amazing";
    			t195 = text(" Website");
    			t196 = space();
    			p35 = element("p");
    			p35.textContent = "This website has been Published with DEV OPS or Continous Deployment on netlify";
    			t198 = space();
    			p36 = element("p");
    			p36.textContent = "for free XD";
    			t200 = space();
    			div92 = element("div");
    			h311 = element("h3");
    			h311.textContent = "Follow Me";
    			t202 = space();
    			ul3 = element("ul");
    			li11 = element("li");
    			a26 = element("a");
    			span16 = element("span");
    			t203 = space();
    			li12 = element("li");
    			a27 = element("a");
    			span17 = element("span");
    			t204 = space();
    			li13 = element("li");
    			a28 = element("a");
    			span18 = element("span");
    			t205 = space();
    			div93 = element("div");
    			p37 = element("p");
    			t206 = text("© 2019 Anent. All rights reserved | Design by\r\n\t\t\t\t\t");
    			a29 = element("a");
    			a29.textContent = "W3layouts.";
    			t208 = space();
    			a30 = element("a");
    			attr_dev(a0, "href", "index.html");
    			attr_dev(a0, "class", "logo text-wh text-uppercase font-weight-light");
    			set_style(a0, "color", "black");
    			add_location(a0, file, 15, 10, 382);
    			add_location(h1, file, 15, 6, 378);
    			attr_dev(p0, "class", "text-bl text-li mt-3");
    			add_location(p0, file, 16, 6, 510);
    			attr_dev(span0, "class", "fa fa-linkedin");
    			add_location(span0, file, 21, 10, 739);
    			attr_dev(a1, "href", "https://www.linkedin.com/in/dustin-walker-pro/");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file, 20, 9, 654);
    			add_location(li0, file, 19, 8, 639);
    			attr_dev(span1, "class", "fa fa-github");
    			add_location(span1, file, 31, 10, 1024);
    			attr_dev(a2, "href", "https://github.com/Dustin-dusTir");
    			attr_dev(a2, "target", "_blank");
    			add_location(a2, file, 30, 9, 953);
    			add_location(li1, file, 29, 8, 938);
    			attr_dev(span2, "class", "fa fa-instagram");
    			add_location(span2, file, 36, 10, 1191);
    			attr_dev(a3, "href", "https://www.instagram.com/dustinwalker/");
    			attr_dev(a3, "target", "_blank");
    			add_location(a3, file, 35, 9, 1113);
    			add_location(li2, file, 34, 8, 1098);
    			attr_dev(ul0, "class", "list-unstyled");
    			add_location(ul0, file, 18, 7, 603);
    			attr_dev(div0, "class", "social-icons mt-4");
    			add_location(div0, file, 17, 6, 563);
    			attr_dev(a4, "href", "#about");
    			attr_dev(a4, "class", "btn button-style mt-5");
    			add_location(a4, file, 41, 6, 1294);
    			attr_dev(div1, "class", "banner-text text-center");
    			add_location(div1, file, 14, 5, 333);
    			attr_dev(div2, "class", "container");
    			add_location(div2, file, 13, 4, 303);
    			attr_dev(div3, "class", "banner-top1");
    			add_location(div3, file, 12, 3, 272);
    			attr_dev(div4, "class", "banner_w3lspvt");
    			add_location(div4, file, 11, 2, 239);
    			attr_dev(div5, "id", "home");
    			add_location(div5, file, 9, 1, 201);
    			attr_dev(h40, "class", "mt-2 let");
    			add_location(h40, file, 53, 3, 1531);
    			attr_dev(input0, "id", "check02");
    			attr_dev(input0, "type", "checkbox");
    			attr_dev(input0, "name", "menu");
    			add_location(input0, file, 57, 5, 1621);
    			attr_dev(span3, "class", "fa fa-bars");
    			attr_dev(span3, "aria-hidden", "true");
    			add_location(span3, file, 58, 26, 1699);
    			attr_dev(label0, "for", "check02");
    			add_location(label0, file, 58, 5, 1678);
    			attr_dev(a5, "href", "index.html");
    			attr_dev(a5, "class", "active");
    			add_location(a5, file, 60, 10, 1797);
    			add_location(li3, file, 60, 6, 1793);
    			attr_dev(a6, "href", "#about");
    			add_location(a6, file, 61, 10, 1858);
    			add_location(li4, file, 61, 6, 1854);
    			attr_dev(a7, "href", "#what");
    			add_location(a7, file, 62, 10, 1903);
    			add_location(li5, file, 62, 6, 1899);
    			attr_dev(a8, "href", "#resume");
    			add_location(a8, file, 63, 10, 1951);
    			add_location(li6, file, 63, 6, 1947);
    			attr_dev(a9, "href", "#projects");
    			add_location(a9, file, 64, 10, 1999);
    			add_location(li7, file, 64, 6, 1995);
    			attr_dev(a10, "href", "#blog");
    			add_location(a10, file, 65, 10, 2048);
    			add_location(li8, file, 65, 6, 2044);
    			attr_dev(a11, "href", "#hire");
    			add_location(a11, file, 66, 10, 2089);
    			add_location(li9, file, 66, 6, 2085);
    			attr_dev(ul1, "class", "submenu");
    			add_location(ul1, file, 59, 5, 1765);
    			add_location(li10, file, 56, 4, 1610);
    			attr_dev(ul2, "id", "menu");
    			add_location(ul2, file, 55, 3, 1590);
    			attr_dev(div6, "class", "container d-flex");
    			add_location(div6, file, 52, 2, 1496);
    			attr_dev(header, "class", "py-2");
    			add_location(header, file, 51, 1, 1471);
    			attr_dev(h30, "class", "tittle-2");
    			add_location(h30, file, 78, 3, 2340);
    			attr_dev(img0, "class", "img-fluid");
    			if (img0.src !== (img0_src_value = "./images/ab2.jpg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			add_location(img0, file, 81, 5, 2485);
    			attr_dev(div7, "class", "col-lg-6 about-img text-center");
    			set_style(div7, "padding-left", "50px");
    			add_location(div7, file, 80, 4, 2406);
    			add_location(br, file, 84, 31, 2623);
    			attr_dev(h41, "class", "about-tit");
    			add_location(h41, file, 84, 5, 2597);
    			set_style(p1, "padding-top", "2em");
    			add_location(p1, file, 85, 5, 2657);
    			add_location(em0, file, 86, 35, 2741);
    			set_style(p2, "text-align", "center");
    			add_location(p2, file, 86, 5, 2711);
    			add_location(p3, file, 87, 5, 2802);
    			add_location(p4, file, 88, 5, 2816);
    			add_location(p5, file, 90, 5, 3045);
    			attr_dev(div8, "class", "col-lg-6 about-right");
    			add_location(div8, file, 83, 4, 2556);
    			attr_dev(div9, "class", "row");
    			add_location(div9, file, 79, 3, 2383);
    			attr_dev(div10, "class", "container pt-lg-4 pb-4");
    			add_location(div10, file, 77, 2, 2299);
    			attr_dev(section0, "class", "about py-5 position-relative");
    			attr_dev(section0, "id", "about");
    			add_location(section0, file, 76, 1, 2238);
    			attr_dev(span4, "class", "fa fa-lightbulb-o");
    			add_location(span4, file, 103, 5, 3470);
    			attr_dev(h42, "class", "mt-4 mb-3 text-bl");
    			add_location(h42, file, 104, 5, 3516);
    			attr_dev(div11, "class", "col-lg-3 col-sm-6 welcome-grid");
    			add_location(div11, file, 102, 4, 3419);
    			attr_dev(span5, "class", "fa fa-bar-chart");
    			add_location(span5, file, 107, 5, 3649);
    			attr_dev(h43, "class", "mt-4 mb-3 text-bl");
    			add_location(h43, file, 108, 5, 3693);
    			attr_dev(div12, "class", "col-lg-3 col-sm-6 welcome-grid mt-sm-0 mt-4");
    			add_location(div12, file, 106, 4, 3585);
    			attr_dev(span6, "class", "fa fa-folder-open");
    			add_location(span6, file, 111, 5, 3817);
    			attr_dev(h44, "class", "mt-4 mb-3 text-bl");
    			add_location(h44, file, 112, 5, 3863);
    			attr_dev(div13, "class", "col-lg-3 col-sm-6 welcome-grid mt-lg-0 mt-4");
    			add_location(div13, file, 110, 4, 3753);
    			attr_dev(span7, "class", "fa fa-desktop");
    			add_location(span7, file, 115, 5, 3988);
    			attr_dev(h45, "class", "mt-4 mb-3 text-bl");
    			add_location(h45, file, 116, 5, 4030);
    			attr_dev(div14, "class", "col-lg-3 col-sm-6 welcome-grid mt-lg-0 mt-4");
    			add_location(div14, file, 114, 4, 3924);
    			attr_dev(div15, "class", "row welcome-bottom text-center mx-auto");
    			add_location(div15, file, 101, 3, 3361);
    			attr_dev(div16, "class", "container pb-xl-5 pb-lg-3");
    			add_location(div16, file, 100, 2, 3317);
    			attr_dev(div17, "class", "serives-w3pvts pb-5 pt-2");
    			add_location(div17, file, 99, 1, 3275);
    			attr_dev(p6, "class", "counter");
    			add_location(p6, file, 128, 5, 4345);
    			attr_dev(p7, "class", "para-text-w3ls text-li");
    			add_location(p7, file, 129, 5, 4378);
    			attr_dev(div18, "class", "col-md-3 col-sm-6 w3layouts_stats_left");
    			add_location(div18, file, 127, 4, 4286);
    			attr_dev(p8, "class", "counter");
    			add_location(p8, file, 132, 5, 4520);
    			attr_dev(p9, "class", "para-text-w3ls text-li");
    			add_location(p9, file, 133, 5, 4557);
    			attr_dev(div19, "class", "col-md-3 col-sm-6 w3layouts_stats_left mt-sm-0 mt-4");
    			add_location(div19, file, 131, 4, 4448);
    			attr_dev(p10, "class", "counter");
    			add_location(p10, file, 136, 5, 4695);
    			attr_dev(p11, "class", "para-text-w3ls text-li");
    			add_location(p11, file, 137, 5, 4726);
    			attr_dev(div20, "class", "col-md-3 col-sm-6 w3layouts_stats_left mt-md-0 mt-4");
    			add_location(div20, file, 135, 4, 4623);
    			attr_dev(p12, "class", "counter");
    			add_location(p12, file, 140, 5, 4864);
    			attr_dev(p13, "class", "para-text-w3ls text-li");
    			add_location(p13, file, 141, 5, 4896);
    			attr_dev(div21, "class", "col-md-3 col-sm-6 w3layouts_stats_left mt-md-0 mt-4");
    			add_location(div21, file, 139, 4, 4792);
    			attr_dev(div22, "class", "row text-center py-sm-3");
    			add_location(div22, file, 126, 3, 4243);
    			attr_dev(div23, "class", "container py-xl-5 py-lg-3");
    			add_location(div23, file, 125, 2, 4199);
    			attr_dev(div24, "class", "stats py-5");
    			add_location(div24, file, 124, 1, 4171);
    			attr_dev(h31, "class", "tittle text-center text-bl mb-sm-5 mb-4");
    			add_location(h31, file, 151, 3, 5138);
    			attr_dev(span8, "class", "fa fa-mobile");
    			add_location(span8, file, 158, 9, 5425);
    			attr_dev(div25, "class", "dodecagon-bg");
    			add_location(div25, file, 157, 8, 5388);
    			attr_dev(div26, "class", "dodecagon-in");
    			add_location(div26, file, 156, 7, 5352);
    			attr_dev(div27, "class", "dodecagon");
    			add_location(div27, file, 155, 6, 5320);
    			add_location(h32, file, 162, 6, 5512);
    			add_location(p14, file, 163, 6, 5543);
    			attr_dev(div28, "class", "abt-block");
    			add_location(div28, file, 154, 5, 5289);
    			attr_dev(div29, "class", "col-lg-4");
    			add_location(div29, file, 153, 4, 5260);
    			attr_dev(span9, "class", "fa fa-lightbulb-o");
    			add_location(span9, file, 171, 9, 5789);
    			attr_dev(div30, "class", "dodecagon-bg back2");
    			add_location(div30, file, 170, 8, 5746);
    			attr_dev(div31, "class", "dodecagon-in");
    			add_location(div31, file, 169, 7, 5710);
    			attr_dev(div32, "class", "dodecagon");
    			add_location(div32, file, 168, 6, 5678);
    			add_location(h33, file, 175, 6, 5881);
    			add_location(p15, file, 176, 6, 5914);
    			attr_dev(div33, "class", "abt-block border-back2");
    			add_location(div33, file, 167, 5, 5634);
    			attr_dev(div34, "class", "col-lg-4");
    			add_location(div34, file, 166, 4, 5605);
    			attr_dev(span10, "class", "fa fa-pie-chart");
    			add_location(span10, file, 184, 9, 6174);
    			attr_dev(div35, "class", "dodecagon-bg back3");
    			add_location(div35, file, 183, 8, 6131);
    			attr_dev(div36, "class", "dodecagon-in");
    			add_location(div36, file, 182, 7, 6095);
    			attr_dev(div37, "class", "dodecagon");
    			add_location(div37, file, 181, 6, 6063);
    			add_location(h34, file, 188, 6, 6264);
    			add_location(p16, file, 189, 6, 6300);
    			attr_dev(div38, "class", "abt-block border-back3");
    			add_location(div38, file, 180, 5, 6019);
    			attr_dev(div39, "class", "col-lg-4");
    			add_location(div39, file, 179, 4, 5990);
    			attr_dev(div40, "class", "row ser-styles ser-styles-res");
    			add_location(div40, file, 152, 3, 5211);
    			attr_dev(span11, "class", "fa fa-ravelry");
    			add_location(span11, file, 199, 9, 6594);
    			attr_dev(div41, "class", "dodecagon-bg back4");
    			add_location(div41, file, 198, 8, 6551);
    			attr_dev(div42, "class", "dodecagon-in");
    			add_location(div42, file, 197, 7, 6515);
    			attr_dev(div43, "class", "dodecagon");
    			add_location(div43, file, 196, 6, 6483);
    			add_location(h35, file, 203, 6, 6682);
    			add_location(p17, file, 204, 6, 6707);
    			attr_dev(div44, "class", "abt-block border-back4");
    			add_location(div44, file, 195, 5, 6439);
    			attr_dev(div45, "class", "col-lg-4");
    			add_location(div45, file, 194, 4, 6410);
    			attr_dev(span12, "class", "fa fa-coffee");
    			add_location(span12, file, 212, 9, 7010);
    			attr_dev(div46, "class", "dodecagon-bg back5");
    			add_location(div46, file, 211, 8, 6967);
    			attr_dev(div47, "class", "dodecagon-in");
    			add_location(div47, file, 210, 7, 6931);
    			attr_dev(div48, "class", "dodecagon");
    			add_location(div48, file, 209, 6, 6899);
    			add_location(h36, file, 216, 6, 7097);
    			add_location(p18, file, 217, 6, 7127);
    			attr_dev(div49, "class", "abt-block border-back5");
    			add_location(div49, file, 208, 5, 6855);
    			attr_dev(div50, "class", "col-lg-4");
    			add_location(div50, file, 207, 4, 6826);
    			attr_dev(span13, "class", "fa fa-umbrella");
    			add_location(span13, file, 225, 9, 7432);
    			attr_dev(div51, "class", "dodecagon-bg back6");
    			add_location(div51, file, 224, 8, 7389);
    			attr_dev(div52, "class", "dodecagon-in");
    			add_location(div52, file, 223, 7, 7353);
    			attr_dev(div53, "class", "dodecagon");
    			add_location(div53, file, 222, 6, 7321);
    			add_location(h37, file, 229, 6, 7521);
    			add_location(p19, file, 230, 6, 7547);
    			attr_dev(div54, "class", "abt-block border-back6");
    			add_location(div54, file, 221, 5, 7277);
    			attr_dev(div55, "class", "col-lg-4");
    			add_location(div55, file, 220, 4, 7248);
    			attr_dev(div56, "class", "row ser-styles");
    			add_location(div56, file, 193, 3, 6376);
    			attr_dev(div57, "class", "container py-xl-5 py-lg-3");
    			add_location(div57, file, 150, 2, 5094);
    			attr_dev(div58, "class", "services text-center pt-5 pb-lg-5");
    			attr_dev(div58, "id", "what");
    			add_location(div58, file, 149, 1, 5033);
    			attr_dev(h38, "class", "tittle-2");
    			add_location(h38, file, 241, 3, 7813);
    			if (img1.src !== (img1_src_value = "./images/per2.jpg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "class", "img-fluid");
    			add_location(img1, file, 244, 5, 7926);
    			attr_dev(div59, "class", "col-lg-4 left-grid-resu");
    			add_location(div59, file, 243, 4, 7882);
    			attr_dev(input1, "id", "tab1");
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "name", "tabs");
    			attr_dev(input1, "class", "w3pvt-sm");
    			input1.checked = true;
    			add_location(input1, file, 247, 5, 8070);
    			attr_dev(span14, "class", "fa fa-graduation-cap");
    			attr_dev(span14, "aria-hidden", "true");
    			add_location(span14, file, 248, 23, 8162);
    			attr_dev(label1, "for", "tab1");
    			add_location(label1, file, 248, 5, 8144);
    			attr_dev(input2, "id", "tab2");
    			attr_dev(input2, "type", "radio");
    			attr_dev(input2, "class", "w3pvt-sm");
    			attr_dev(input2, "name", "tabs");
    			add_location(input2, file, 249, 5, 8247);
    			attr_dev(span15, "class", "fa fa-briefcase");
    			attr_dev(span15, "aria-hidden", "true");
    			add_location(span15, file, 250, 23, 8331);
    			attr_dev(label2, "for", "tab2");
    			add_location(label2, file, 250, 5, 8313);
    			add_location(h46, file, 253, 7, 8487);
    			add_location(h60, file, 254, 7, 8528);
    			add_location(p20, file, 255, 7, 8575);
    			attr_dev(div60, "class", "inner-w3pvt-wrap mt-3");
    			add_location(div60, file, 252, 6, 8443);
    			add_location(h47, file, 258, 7, 8711);
    			add_location(h61, file, 259, 7, 8753);
    			add_location(p21, file, 260, 7, 8782);
    			attr_dev(div61, "class", "inner-w3pvt-wrap");
    			add_location(div61, file, 257, 6, 8672);
    			add_location(h48, file, 266, 7, 9050);
    			add_location(h62, file, 267, 7, 9093);
    			add_location(p22, file, 268, 7, 9147);
    			add_location(p23, file, 269, 7, 9195);
    			attr_dev(div62, "class", "inner-w3pvt-wrap");
    			add_location(div62, file, 265, 6, 9011);
    			attr_dev(section1, "id", "content1");
    			add_location(section1, file, 251, 5, 8412);
    			add_location(h49, file, 274, 7, 9317);
    			add_location(h63, file, 275, 7, 9360);
    			add_location(p24, file, 276, 7, 9392);
    			add_location(p25, file, 277, 7, 9441);
    			attr_dev(div63, "class", "inner-w3pvt-wrap mt-3");
    			add_location(div63, file, 273, 6, 9273);
    			add_location(h410, file, 280, 7, 9593);
    			add_location(h64, file, 281, 7, 9625);
    			add_location(p26, file, 282, 7, 9700);
    			attr_dev(div64, "class", "inner-w3pvt-wrap");
    			add_location(div64, file, 279, 6, 9554);
    			add_location(h411, file, 285, 7, 9826);
    			add_location(h65, file, 286, 7, 9858);
    			add_location(p27, file, 287, 7, 9932);
    			attr_dev(div65, "class", "inner-w3pvt-wrap");
    			add_location(div65, file, 284, 6, 9787);
    			attr_dev(section2, "id", "content2");
    			add_location(section2, file, 272, 5, 9242);
    			attr_dev(div66, "class", "col-xl-7 col-lg-8 tab-main offset-xl-1 py-lg-0 py-5");
    			add_location(div66, file, 246, 4, 7998);
    			attr_dev(div67, "class", "d-lg-flex");
    			add_location(div67, file, 242, 3, 7853);
    			attr_dev(div68, "class", "container pt-lg-5");
    			add_location(div68, file, 240, 2, 7777);
    			attr_dev(div69, "class", "middile-inner-con position-relative");
    			attr_dev(div69, "id", "resume");
    			add_location(div69, file, 239, 1, 7712);
    			attr_dev(h39, "class", "w3pvt-web-title");
    			add_location(h39, file, 300, 4, 10275);
    			attr_dev(div70, "class", "cont-w3pvt");
    			add_location(div70, file, 299, 3, 10245);
    			attr_dev(div71, "class", "container py-xl-5");
    			add_location(div71, file, 298, 2, 10209);
    			attr_dev(section3, "class", "w3ls-bnrbtm py-5 text-center");
    			add_location(section3, file, 297, 1, 10159);
    			attr_dev(h310, "class", "tittle text-center text-bl mb-sm-5 mb-4");
    			add_location(h310, file, 310, 3, 10615);
    			if (img2.src !== (img2_src_value = "./images/g3.jpg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "news image");
    			attr_dev(img2, "class", "img-fluid");
    			add_location(img2, file, 314, 22, 10846);
    			attr_dev(a12, "href", "#gal3");
    			add_location(a12, file, 314, 6, 10830);
    			if (img3.src !== (img3_src_value = "./images/Pointclouds.jpg")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "news image");
    			attr_dev(img3, "class", "img-fluid");
    			add_location(img3, file, 315, 22, 10936);
    			attr_dev(a13, "href", "#gal2");
    			add_location(a13, file, 315, 6, 10920);
    			attr_dev(div72, "class", "col-md-4 gal-img");
    			add_location(div72, file, 313, 5, 10792);
    			if (img4.src !== (img4_src_value = "./images/desk.jpg")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "news image");
    			attr_dev(img4, "class", "img-fluid");
    			add_location(img4, file, 318, 22, 11085);
    			attr_dev(a14, "href", "#gal4");
    			add_location(a14, file, 318, 6, 11069);
    			if (img5.src !== (img5_src_value = "./images/g1.jpg")) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "news image");
    			attr_dev(img5, "class", "img-fluid");
    			add_location(img5, file, 319, 22, 11177);
    			attr_dev(a15, "href", "#gal1");
    			add_location(a15, file, 319, 6, 11161);
    			attr_dev(div73, "class", "col-md-4 gal-img");
    			add_location(div73, file, 317, 5, 11031);
    			if (img6.src !== (img6_src_value = "./images/g5.jpg")) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "news image");
    			attr_dev(img6, "class", "img-fluid");
    			add_location(img6, file, 322, 22, 11317);
    			attr_dev(a16, "href", "#gal5");
    			add_location(a16, file, 322, 6, 11301);
    			if (img7.src !== (img7_src_value = "./images/g6.jpg")) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "news image");
    			attr_dev(img7, "class", "img-fluid");
    			add_location(img7, file, 323, 22, 11407);
    			attr_dev(a17, "href", "#gal6");
    			add_location(a17, file, 323, 6, 11391);
    			attr_dev(div74, "class", "col-md-4 gal-img");
    			add_location(div74, file, 321, 5, 11263);
    			attr_dev(div75, "class", "row no-gutters news-grids text-center");
    			add_location(div75, file, 312, 4, 10734);
    			attr_dev(div76, "class", "news-grids text-center");
    			add_location(div76, file, 311, 3, 10692);
    			attr_dev(div77, "class", "container py-xl-5 py-lg-3");
    			add_location(div77, file, 309, 2, 10571);
    			attr_dev(div78, "class", "gallery py-5");
    			attr_dev(div78, "id", "projects");
    			add_location(div78, file, 308, 1, 10527);
    			if (img8.src !== (img8_src_value = "./images/g1.jpg")) attr_dev(img8, "src", img8_src_value);
    			attr_dev(img8, "alt", "Popup Image");
    			attr_dev(img8, "class", "img-fluid");
    			add_location(img8, file, 332, 3, 11619);
    			attr_dev(p28, "class", "mt-4");
    			add_location(p28, file, 333, 3, 11689);
    			attr_dev(a18, "class", "close");
    			attr_dev(a18, "href", "#gallery");
    			add_location(a18, file, 334, 3, 11802);
    			attr_dev(div79, "class", "popup");
    			add_location(div79, file, 331, 2, 11595);
    			attr_dev(div80, "id", "gal1");
    			attr_dev(div80, "class", "popup-effect animate");
    			add_location(div80, file, 330, 1, 11547);
    			if (img9.src !== (img9_src_value = "./images/Pointclouds.png")) attr_dev(img9, "src", img9_src_value);
    			attr_dev(img9, "alt", "Popup Image");
    			attr_dev(img9, "class", "img-fluid");
    			add_location(img9, file, 341, 3, 11975);
    			attr_dev(p29, "class", "mt-4");
    			add_location(p29, file, 342, 3, 12054);
    			attr_dev(a19, "href", "https://www.kaggle.com/dustindustir/vergleich-von-messmethoden-fuer-punktwolken");
    			attr_dev(a19, "target", "blank");
    			add_location(a19, file, 343, 34, 12178);
    			attr_dev(p30, "class", "mt-4");
    			add_location(p30, file, 343, 3, 12147);
    			attr_dev(a20, "class", "close");
    			attr_dev(a20, "href", "#gallery");
    			add_location(a20, file, 344, 3, 12310);
    			attr_dev(div81, "class", "popup");
    			add_location(div81, file, 340, 2, 11951);
    			attr_dev(div82, "id", "gal2");
    			attr_dev(div82, "class", "popup-effect animate");
    			add_location(div82, file, 339, 1, 11903);
    			if (img10.src !== (img10_src_value = "./images/g3.jpg")) attr_dev(img10, "src", img10_src_value);
    			attr_dev(img10, "alt", "Popup Image");
    			attr_dev(img10, "class", "img-fluid");
    			add_location(img10, file, 351, 3, 12483);
    			attr_dev(p31, "class", "mt-4");
    			add_location(p31, file, 352, 3, 12553);
    			attr_dev(a21, "class", "close");
    			attr_dev(a21, "href", "#gallery");
    			add_location(a21, file, 353, 3, 12666);
    			attr_dev(div83, "class", "popup");
    			add_location(div83, file, 350, 2, 12459);
    			attr_dev(div84, "id", "gal3");
    			attr_dev(div84, "class", "popup-effect animate");
    			add_location(div84, file, 349, 1, 12411);
    			if (img11.src !== (img11_src_value = "./images/desk.jpg")) attr_dev(img11, "src", img11_src_value);
    			attr_dev(img11, "alt", "Popup Image");
    			attr_dev(img11, "class", "img-fluid");
    			add_location(img11, file, 360, 3, 12840);
    			attr_dev(p32, "class", "mt-4");
    			add_location(p32, file, 361, 3, 12912);
    			attr_dev(a22, "class", "close");
    			attr_dev(a22, "href", "#gallery");
    			add_location(a22, file, 362, 3, 12976);
    			attr_dev(div85, "class", "popup");
    			add_location(div85, file, 359, 2, 12816);
    			attr_dev(div86, "id", "gal4");
    			attr_dev(div86, "class", "popup-effect animate");
    			add_location(div86, file, 358, 1, 12768);
    			if (img12.src !== (img12_src_value = "./images/g5.jpg")) attr_dev(img12, "src", img12_src_value);
    			attr_dev(img12, "alt", "Popup Image");
    			attr_dev(img12, "class", "img-fluid");
    			add_location(img12, file, 369, 3, 13149);
    			attr_dev(p33, "class", "mt-4");
    			add_location(p33, file, 370, 3, 13219);
    			attr_dev(a23, "class", "close");
    			attr_dev(a23, "href", "#gallery");
    			add_location(a23, file, 371, 3, 13332);
    			attr_dev(div87, "class", "popup");
    			add_location(div87, file, 368, 2, 13125);
    			attr_dev(div88, "id", "gal5");
    			attr_dev(div88, "class", "popup-effect animate");
    			add_location(div88, file, 367, 1, 13077);
    			if (img13.src !== (img13_src_value = "./images/g6.jpg")) attr_dev(img13, "src", img13_src_value);
    			attr_dev(img13, "alt", "Popup Image");
    			attr_dev(img13, "class", "img-fluid");
    			add_location(img13, file, 378, 3, 13505);
    			attr_dev(p34, "class", "mt-4");
    			add_location(p34, file, 379, 3, 13575);
    			attr_dev(a24, "class", "close");
    			attr_dev(a24, "href", "#gallery");
    			add_location(a24, file, 380, 3, 13688);
    			attr_dev(div89, "class", "popup");
    			add_location(div89, file, 377, 2, 13481);
    			attr_dev(div90, "id", "gal6");
    			attr_dev(div90, "class", "popup-effect animate");
    			add_location(div90, file, 376, 1, 13433);
    			add_location(em1, file, 446, 100, 16188);
    			attr_dev(a25, "href", "index.html");
    			attr_dev(a25, "class", "logo text-wh text-uppercase font-weight-light");
    			add_location(a25, file, 446, 8, 16096);
    			add_location(h2, file, 446, 4, 16092);
    			attr_dev(p35, "class", "foot-para mx-auto mt-3");
    			add_location(p35, file, 447, 4, 16227);
    			add_location(p36, file, 448, 4, 16350);
    			attr_dev(div91, "class", "logo-2");
    			add_location(div91, file, 445, 3, 16066);
    			attr_dev(h311, "class", "footer-title text-wh mb-lg-4 mb-3");
    			add_location(h311, file, 451, 4, 16443);
    			attr_dev(span16, "class", "fa fa-dribbble");
    			add_location(span16, file, 455, 7, 16629);
    			attr_dev(a26, "href", "#");
    			add_location(a26, file, 454, 6, 16608);
    			attr_dev(li11, "class", "w3_w3pvt-web_dribble");
    			add_location(li11, file, 453, 5, 16567);
    			attr_dev(span17, "class", "fa fa-github");
    			add_location(span17, file, 460, 7, 16806);
    			attr_dev(a27, "href", "https://github.com/Dustin-dusTir");
    			attr_dev(a27, "target", "_blank");
    			add_location(a27, file, 459, 6, 16738);
    			attr_dev(li12, "class", "w3_w3pvt-web_facebook");
    			add_location(li12, file, 458, 5, 16696);
    			attr_dev(span18, "class", "fa fa-instagram");
    			add_location(span18, file, 465, 7, 16986);
    			attr_dev(a28, "href", "https://www.instagram.com/dustinwalker/");
    			attr_dev(a28, "target", "_blank");
    			add_location(a28, file, 464, 6, 16911);
    			attr_dev(li13, "class", "w3_w3pvt-web_google");
    			add_location(li13, file, 463, 5, 16871);
    			attr_dev(ul3, "class", "w3pvt-webits_social_list list-unstyled");
    			add_location(ul3, file, 452, 4, 16509);
    			attr_dev(div92, "class", "w3pvt-webinfo_social_icons mt-lg-5 mt-4");
    			add_location(div92, file, 450, 3, 16384);
    			attr_dev(a29, "href", "http://w3layouts.com");
    			add_location(a29, file, 472, 5, 17215);
    			attr_dev(p37, "class", "border-top mt-lg-5 mt-4");
    			add_location(p37, file, 471, 4, 17128);
    			attr_dev(div93, "class", "cpy-right text-center mx-auto py-3");
    			add_location(div93, file, 470, 3, 17074);
    			attr_dev(div94, "class", "container py-xl-5 py-lg-4");
    			add_location(div94, file, 444, 2, 16022);
    			attr_dev(footer, "class", "text-center py-5");
    			add_location(footer, file, 443, 1, 15985);
    			attr_dev(a30, "href", "#home");
    			attr_dev(a30, "class", "move-top text-center");
    			add_location(a30, file, 479, 1, 17352);
    			add_location(body, file, 7, 0, 176);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, body, anchor);
    			append_dev(body, div5);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, h1);
    			append_dev(h1, a0);
    			append_dev(div1, t1);
    			append_dev(div1, p0);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a1);
    			append_dev(a1, span0);
    			append_dev(ul0, t4);
    			append_dev(ul0, li1);
    			append_dev(li1, a2);
    			append_dev(a2, span1);
    			append_dev(ul0, t5);
    			append_dev(ul0, li2);
    			append_dev(li2, a3);
    			append_dev(a3, span2);
    			append_dev(div1, t6);
    			append_dev(div1, a4);
    			append_dev(body, t8);
    			append_dev(body, header);
    			append_dev(header, div6);
    			append_dev(div6, h40);
    			append_dev(div6, t10);
    			append_dev(div6, ul2);
    			append_dev(ul2, li10);
    			append_dev(li10, input0);
    			append_dev(li10, t11);
    			append_dev(li10, label0);
    			append_dev(label0, span3);
    			append_dev(li10, t12);
    			append_dev(li10, ul1);
    			append_dev(ul1, li3);
    			append_dev(li3, a5);
    			append_dev(ul1, t14);
    			append_dev(ul1, li4);
    			append_dev(li4, a6);
    			append_dev(ul1, t16);
    			append_dev(ul1, li5);
    			append_dev(li5, a7);
    			append_dev(ul1, t18);
    			append_dev(ul1, li6);
    			append_dev(li6, a8);
    			append_dev(ul1, t20);
    			append_dev(ul1, li7);
    			append_dev(li7, a9);
    			append_dev(ul1, t22);
    			append_dev(ul1, li8);
    			append_dev(li8, a10);
    			append_dev(ul1, t24);
    			append_dev(ul1, li9);
    			append_dev(li9, a11);
    			append_dev(body, t26);
    			append_dev(body, section0);
    			append_dev(section0, div10);
    			append_dev(div10, h30);
    			append_dev(div10, t28);
    			append_dev(div10, div9);
    			append_dev(div9, div7);
    			append_dev(div7, img0);
    			append_dev(div9, t29);
    			append_dev(div9, div8);
    			append_dev(div8, h41);
    			append_dev(h41, t30);
    			append_dev(h41, br);
    			append_dev(h41, t31);
    			append_dev(div8, t32);
    			append_dev(div8, p1);
    			append_dev(div8, t34);
    			append_dev(div8, p2);
    			append_dev(p2, em0);
    			append_dev(div8, t36);
    			append_dev(div8, p3);
    			append_dev(div8, t37);
    			append_dev(div8, p4);
    			append_dev(div8, t39);
    			append_dev(div8, p5);
    			append_dev(body, t41);
    			append_dev(body, div17);
    			append_dev(div17, div16);
    			append_dev(div16, div15);
    			append_dev(div15, div11);
    			append_dev(div11, span4);
    			append_dev(div11, t42);
    			append_dev(div11, h42);
    			append_dev(div15, t44);
    			append_dev(div15, div12);
    			append_dev(div12, span5);
    			append_dev(div12, t45);
    			append_dev(div12, h43);
    			append_dev(div15, t47);
    			append_dev(div15, div13);
    			append_dev(div13, span6);
    			append_dev(div13, t48);
    			append_dev(div13, h44);
    			append_dev(div15, t50);
    			append_dev(div15, div14);
    			append_dev(div14, span7);
    			append_dev(div14, t51);
    			append_dev(div14, h45);
    			append_dev(body, t53);
    			append_dev(body, div24);
    			append_dev(div24, div23);
    			append_dev(div23, div22);
    			append_dev(div22, div18);
    			append_dev(div18, p6);
    			append_dev(div18, t55);
    			append_dev(div18, p7);
    			append_dev(div22, t57);
    			append_dev(div22, div19);
    			append_dev(div19, p8);
    			append_dev(div19, t59);
    			append_dev(div19, p9);
    			append_dev(div22, t61);
    			append_dev(div22, div20);
    			append_dev(div20, p10);
    			append_dev(div20, t63);
    			append_dev(div20, p11);
    			append_dev(div22, t65);
    			append_dev(div22, div21);
    			append_dev(div21, p12);
    			append_dev(div21, t67);
    			append_dev(div21, p13);
    			append_dev(body, t69);
    			append_dev(body, div58);
    			append_dev(div58, div57);
    			append_dev(div57, h31);
    			append_dev(div57, t71);
    			append_dev(div57, div40);
    			append_dev(div40, div29);
    			append_dev(div29, div28);
    			append_dev(div28, div27);
    			append_dev(div27, div26);
    			append_dev(div26, div25);
    			append_dev(div25, span8);
    			append_dev(div28, t72);
    			append_dev(div28, h32);
    			append_dev(div28, t74);
    			append_dev(div28, p14);
    			append_dev(div40, t76);
    			append_dev(div40, div34);
    			append_dev(div34, div33);
    			append_dev(div33, div32);
    			append_dev(div32, div31);
    			append_dev(div31, div30);
    			append_dev(div30, span9);
    			append_dev(div33, t77);
    			append_dev(div33, h33);
    			append_dev(div33, t79);
    			append_dev(div33, p15);
    			append_dev(div40, t81);
    			append_dev(div40, div39);
    			append_dev(div39, div38);
    			append_dev(div38, div37);
    			append_dev(div37, div36);
    			append_dev(div36, div35);
    			append_dev(div35, span10);
    			append_dev(div38, t82);
    			append_dev(div38, h34);
    			append_dev(div38, t84);
    			append_dev(div38, p16);
    			append_dev(div57, t86);
    			append_dev(div57, div56);
    			append_dev(div56, div45);
    			append_dev(div45, div44);
    			append_dev(div44, div43);
    			append_dev(div43, div42);
    			append_dev(div42, div41);
    			append_dev(div41, span11);
    			append_dev(div44, t87);
    			append_dev(div44, h35);
    			append_dev(div44, t89);
    			append_dev(div44, p17);
    			append_dev(div56, t91);
    			append_dev(div56, div50);
    			append_dev(div50, div49);
    			append_dev(div49, div48);
    			append_dev(div48, div47);
    			append_dev(div47, div46);
    			append_dev(div46, span12);
    			append_dev(div49, t92);
    			append_dev(div49, h36);
    			append_dev(div49, t94);
    			append_dev(div49, p18);
    			append_dev(div56, t96);
    			append_dev(div56, div55);
    			append_dev(div55, div54);
    			append_dev(div54, div53);
    			append_dev(div53, div52);
    			append_dev(div52, div51);
    			append_dev(div51, span13);
    			append_dev(div54, t97);
    			append_dev(div54, h37);
    			append_dev(div54, t99);
    			append_dev(div54, p19);
    			append_dev(body, t101);
    			append_dev(body, div69);
    			append_dev(div69, div68);
    			append_dev(div68, h38);
    			append_dev(div68, t103);
    			append_dev(div68, div67);
    			append_dev(div67, div59);
    			append_dev(div59, img1);
    			append_dev(div67, t104);
    			append_dev(div67, div66);
    			append_dev(div66, input1);
    			append_dev(div66, t105);
    			append_dev(div66, label1);
    			append_dev(label1, span14);
    			append_dev(label1, t106);
    			append_dev(div66, t107);
    			append_dev(div66, input2);
    			append_dev(div66, t108);
    			append_dev(div66, label2);
    			append_dev(label2, span15);
    			append_dev(label2, t109);
    			append_dev(div66, t110);
    			append_dev(div66, section1);
    			append_dev(section1, div60);
    			append_dev(div60, h46);
    			append_dev(div60, t112);
    			append_dev(div60, h60);
    			append_dev(div60, t114);
    			append_dev(div60, p20);
    			append_dev(section1, t116);
    			append_dev(section1, div61);
    			append_dev(div61, h47);
    			append_dev(div61, t118);
    			append_dev(div61, h61);
    			append_dev(div61, t120);
    			append_dev(div61, p21);
    			append_dev(section1, t122);
    			append_dev(section1, div62);
    			append_dev(div62, h48);
    			append_dev(div62, t124);
    			append_dev(div62, h62);
    			append_dev(div62, t126);
    			append_dev(div62, p22);
    			append_dev(div62, t128);
    			append_dev(div62, p23);
    			append_dev(div66, t129);
    			append_dev(div66, section2);
    			append_dev(section2, div63);
    			append_dev(div63, h49);
    			append_dev(div63, t131);
    			append_dev(div63, h63);
    			append_dev(div63, t133);
    			append_dev(div63, p24);
    			append_dev(div63, t135);
    			append_dev(div63, p25);
    			append_dev(section2, t137);
    			append_dev(section2, div64);
    			append_dev(div64, h410);
    			append_dev(div64, t139);
    			append_dev(div64, h64);
    			append_dev(div64, t141);
    			append_dev(div64, p26);
    			append_dev(section2, t143);
    			append_dev(section2, div65);
    			append_dev(div65, h411);
    			append_dev(div65, t145);
    			append_dev(div65, h65);
    			append_dev(div65, t147);
    			append_dev(div65, p27);
    			append_dev(body, t149);
    			append_dev(body, section3);
    			append_dev(section3, div71);
    			append_dev(div71, div70);
    			append_dev(div70, h39);
    			append_dev(body, t151);
    			append_dev(body, div78);
    			append_dev(div78, div77);
    			append_dev(div77, h310);
    			append_dev(div77, t153);
    			append_dev(div77, div76);
    			append_dev(div76, div75);
    			append_dev(div75, div72);
    			append_dev(div72, a12);
    			append_dev(a12, img2);
    			append_dev(div72, t154);
    			append_dev(div72, a13);
    			append_dev(a13, img3);
    			append_dev(div75, t155);
    			append_dev(div75, div73);
    			append_dev(div73, a14);
    			append_dev(a14, img4);
    			append_dev(div73, t156);
    			append_dev(div73, a15);
    			append_dev(a15, img5);
    			append_dev(div75, t157);
    			append_dev(div75, div74);
    			append_dev(div74, a16);
    			append_dev(a16, img6);
    			append_dev(div74, t158);
    			append_dev(div74, a17);
    			append_dev(a17, img7);
    			append_dev(body, t159);
    			append_dev(body, div80);
    			append_dev(div80, div79);
    			append_dev(div79, img8);
    			append_dev(div79, t160);
    			append_dev(div79, p28);
    			append_dev(div79, t162);
    			append_dev(div79, a18);
    			append_dev(body, t164);
    			append_dev(body, div82);
    			append_dev(div82, div81);
    			append_dev(div81, img9);
    			append_dev(div81, t165);
    			append_dev(div81, p29);
    			append_dev(div81, t167);
    			append_dev(div81, p30);
    			append_dev(p30, t168);
    			append_dev(p30, a19);
    			append_dev(div81, t170);
    			append_dev(div81, a20);
    			append_dev(body, t172);
    			append_dev(body, div84);
    			append_dev(div84, div83);
    			append_dev(div83, img10);
    			append_dev(div83, t173);
    			append_dev(div83, p31);
    			append_dev(div83, t175);
    			append_dev(div83, a21);
    			append_dev(body, t177);
    			append_dev(body, div86);
    			append_dev(div86, div85);
    			append_dev(div85, img11);
    			append_dev(div85, t178);
    			append_dev(div85, p32);
    			append_dev(div85, t180);
    			append_dev(div85, a22);
    			append_dev(body, t182);
    			append_dev(body, div88);
    			append_dev(div88, div87);
    			append_dev(div87, img12);
    			append_dev(div87, t183);
    			append_dev(div87, p33);
    			append_dev(div87, t185);
    			append_dev(div87, a23);
    			append_dev(body, t187);
    			append_dev(body, div90);
    			append_dev(div90, div89);
    			append_dev(div89, img13);
    			append_dev(div89, t188);
    			append_dev(div89, p34);
    			append_dev(div89, t190);
    			append_dev(div89, a24);
    			append_dev(body, t192);
    			append_dev(body, footer);
    			append_dev(footer, div94);
    			append_dev(div94, div91);
    			append_dev(div91, h2);
    			append_dev(h2, a25);
    			append_dev(a25, t193);
    			append_dev(a25, em1);
    			append_dev(a25, t195);
    			append_dev(div91, t196);
    			append_dev(div91, p35);
    			append_dev(div91, t198);
    			append_dev(div91, p36);
    			append_dev(div94, t200);
    			append_dev(div94, div92);
    			append_dev(div92, h311);
    			append_dev(div92, t202);
    			append_dev(div92, ul3);
    			append_dev(ul3, li11);
    			append_dev(li11, a26);
    			append_dev(a26, span16);
    			append_dev(ul3, t203);
    			append_dev(ul3, li12);
    			append_dev(li12, a27);
    			append_dev(a27, span17);
    			append_dev(ul3, t204);
    			append_dev(ul3, li13);
    			append_dev(li13, a28);
    			append_dev(a28, span18);
    			append_dev(div94, t205);
    			append_dev(div94, div93);
    			append_dev(div93, p37);
    			append_dev(p37, t206);
    			append_dev(p37, a29);
    			append_dev(body, t208);
    			append_dev(body, a30);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
