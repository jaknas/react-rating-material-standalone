import * as React from "react";

// based on https://github.com/WICG/focus-visible/blob/v4.1.5/src/focus-visible.js

let hadKeyboardEvent = true;
let hadFocusVisibleRecently = false;
let hadFocusVisibleRecentlyTimeout = null;

const inputTypesWhitelist = {
  text: true,
  search: true,
  url: true,
  tel: true,
  email: true,
  password: true,
  number: true,
  date: true,
  month: true,
  week: true,
  time: true,
  datetime: true,
  "datetime-local": true
};

/**
 * Computes whether the given element should automatically trigger the
 * `focus-visible` class being added, i.e. whether it should always match
 * `:focus-visible` when focused.
 * @param {Element} node
 * @returns {boolean}
 */
function focusTriggersKeyboardModality(node) {
  const { type, tagName } = node;

  if (tagName === "INPUT" && inputTypesWhitelist[type] && !node.readOnly) {
    return true;
  }

  if (tagName === "TEXTAREA" && !node.readOnly) {
    return true;
  }

  if (node.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Keep track of our keyboard modality state with `hadKeyboardEvent`.
 * If the most recent user interaction was via the keyboard;
 * and the key press did not include a meta, alt/option, or control key;
 * then the modality is keyboard. Otherwise, the modality is not keyboard.
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  if (event.metaKey || event.altKey || event.ctrlKey) {
    return;
  }
  hadKeyboardEvent = true;
}

/**
 * If at any point a user clicks with a pointing device, ensure that we change
 * the modality away from keyboard.
 * This avoids the situation where a user presses a key on an already focused
 * element, and then clicks on a different element, focusing it with a
 * pointing device, while we still think we're in keyboard modality.
 */
function handlePointerDown() {
  hadKeyboardEvent = false;
}

function handleVisibilityChange() {
  if (this.visibilityState === "hidden") {
    // If the tab becomes active again, the browser will handle calling focus
    // on the element (Safari actually calls it twice).
    // If this tab change caused a blur on an element with focus-visible,
    // re-apply the class when the user switches back to the tab.
    if (hadFocusVisibleRecently) {
      hadKeyboardEvent = true;
    }
  }
}

function prepare(doc) {
  doc.addEventListener("keydown", handleKeyDown, true);
  doc.addEventListener("mousedown", handlePointerDown, true);
  doc.addEventListener("pointerdown", handlePointerDown, true);
  doc.addEventListener("touchstart", handlePointerDown, true);
  doc.addEventListener("visibilitychange", handleVisibilityChange, true);
}

export function teardown(doc) {
  doc.removeEventListener("keydown", handleKeyDown, true);
  doc.removeEventListener("mousedown", handlePointerDown, true);
  doc.removeEventListener("pointerdown", handlePointerDown, true);
  doc.removeEventListener("touchstart", handlePointerDown, true);
  doc.removeEventListener("visibilitychange", handleVisibilityChange, true);
}

function isFocusVisible(event) {
  const { target } = event;
  try {
    return target.matches(":focus-visible");
  } catch (error) {
    // Browsers not implementing :focus-visible will throw a SyntaxError.
    // We use our own heuristic for those browsers.
    // Rethrow might be better if it's not the expected error but do we really
    // want to crash if focus-visible malfunctioned?
  }

  // No need for validFocusTarget check. The user does that by attaching it to
  // focusable events only.
  return hadKeyboardEvent || focusTriggersKeyboardModality(target);
}

export function useIsFocusVisible() {
  const ref = React.useCallback((node) => {
    if (node != null) {
      prepare(node.ownerDocument);
    }
  }, []);

  const isFocusVisibleRef = React.useRef(false);

  /**
   * Should be called if a blur event is fired
   */
  function handleBlurVisible() {
    // checking against potential state variable does not suffice if we focus and blur synchronously.
    // React wouldn't have time to trigger a re-render so `focusVisible` would be stale.
    // Ideally we would adjust `isFocusVisible(event)` to look at `relatedTarget` for blur events.
    // This doesn't work in IE11 due to https://github.com/facebook/react/issues/3751
    // TODO: check again if React releases their internal changes to focus event handling (https://github.com/facebook/react/pull/19186).
    if (isFocusVisibleRef.current) {
      // To detect a tab/window switch, we look for a blur event followed
      // rapidly by a visibility change.
      // If we don't see a visibility change within 100ms, it's probably a
      // regular focus change.
      hadFocusVisibleRecently = true;
      window.clearTimeout(hadFocusVisibleRecentlyTimeout);
      hadFocusVisibleRecentlyTimeout = window.setTimeout(() => {
        hadFocusVisibleRecently = false;
      }, 100);

      isFocusVisibleRef.current = false;

      return true;
    }

    return false;
  }

  /**
   * Should be called if a blur event is fired
   */
  function handleFocusVisible(event) {
    if (isFocusVisible(event)) {
      isFocusVisibleRef.current = true;
      return true;
    }
    return false;
  }

  return {
    isFocusVisibleRef,
    onFocus: handleFocusVisible,
    onBlur: handleBlurVisible,
    ref
  };
}

function setRef<T>(
  ref:
    | React.MutableRefObject<T | null>
    | ((instance: T | null) => void)
    | null
    | undefined,
  value: T | null
): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export function capitalize(string) {
  if (typeof string !== "string") {
    throw new Error(
      "Material-UI: `capitalize(string)` expects a string argument."
    );
  }

  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function useForkRef<Instance>(
  refA: React.Ref<Instance> | null | undefined,
  refB: React.Ref<Instance> | null | undefined
): React.Ref<Instance> | null {
  /**
   * This will create a new function if the ref props change and are defined.
   * This means react will call the old forkRef with `null` and the new forkRef
   * with the ref. Cleanup naturally emerges from this behavior.
   */
  return React.useMemo(() => {
    if (refA == null && refB == null) {
      return null;
    }
    return (refValue) => {
      setRef(refA, refValue);
      setRef(refB, refValue);
    };
  }, [refA, refB]);
}

export function useId(idOverride?: string): string | undefined {
  const [defaultId, setDefaultId] = React.useState(idOverride);
  const id = idOverride || defaultId;
  React.useEffect(() => {
    if (defaultId == null) {
      // Fallback to this default id when possible.
      // Use the random value for client-side rendering only.
      // We can't use it server-side.
      setDefaultId(`mui-${Math.round(Math.random() * 1e5)}`);
    }
  }, [defaultId]);
  return id;
}

/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
export function useControlled({
  controlled,
  default: defaultProp,
  name,
  state = "value"
}) {
  // isControlled is ignored in the hook dependency lists as it should never change.
  const { current: isControlled } = React.useRef(controlled !== undefined);
  const [valueState, setValue] = React.useState(defaultProp);
  const value = isControlled ? controlled : valueState;

  if (process.env.NODE_ENV !== "production") {
    React.useEffect(() => {
      if (isControlled !== (controlled !== undefined)) {
        console.error(
          [
            `Material-UI: A component is changing the ${
              isControlled ? "" : "un"
            }controlled ${state} state of ${name} to be ${
              isControlled ? "un" : ""
            }controlled.`,
            "Elements should not switch from uncontrolled to controlled (or vice versa).",
            `Decide between using a controlled or uncontrolled ${name} ` +
              "element for the lifetime of the component.",
            "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.",
            "More info: https://fb.me/react-controlled-components"
          ].join("\n")
        );
      }
    }, [state, name, controlled]);

    const { current: defaultValue } = React.useRef(defaultProp);

    React.useEffect(() => {
      if (!isControlled && defaultValue !== defaultProp) {
        console.error(
          [
            `Material-UI: A component is changing the default ${state} state of an uncontrolled ${name} after being initialized. ` +
              `To suppress this warning opt to use a controlled ${name}.`
          ].join("\n")
        );
      }
    }, [JSON.stringify(defaultProp)]);
  }

  const setValueIfUncontrolled = React.useCallback((newValue) => {
    if (!isControlled) {
      setValue(newValue);
    }
  }, []);

  return [value, setValueIfUncontrolled];
}

export function createSvgIcon(path, displayName) {
  const Component = (props, ref) => (
    <svg
      data-testid={`${displayName}Icon`}
      ref={ref}
      {...props}
      style={{ width: "1em", height: "1em" }}
    >
      {path}
    </svg>
  );

  if (process.env.NODE_ENV !== "production") {
    // Need to set `displayName` on the inner component for React.memo.
    // React prior to 16.14 ignores `displayName` on the wrapper.
    Component.displayName = `${displayName}Icon`;
  }

  return React.memo(React.forwardRef(Component));
}
