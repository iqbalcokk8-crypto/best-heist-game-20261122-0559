// BRANKAS EMAS — keyboard + mouse, kept apart from the simulation so the
// autopilot can drive the same step function with a plain input object.
// WASD/arrows move, Shift sprints (loud), E (hold) cracks the vault,
// Q fires the EMP, F drops smoke, P pauses, Space/click starts the game.
export function createInput() {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, crack: false, emp: false, smoke: false,
    pause: false, start: false, clickX: 0, clickY: 0,
    hasClick: false, mouseX: 0, mouseY: 0,
  };
}

export function takeClick(input) {
  const had = input.hasClick;
  input.hasClick = false;
  return had;
}

export function attachInput(input, element) {
  const down = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.up = true; break;
      case 'KeyS': case 'ArrowDown': input.down = true; break;
      case 'KeyA': case 'ArrowLeft': input.left = true; break;
      case 'KeyD': case 'ArrowRight': input.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': input.sprint = true; break;
      case 'KeyE': input.crack = true; break;
      case 'KeyQ': input.emp = true; break;
      case 'KeyF': input.smoke = true; break;
      case 'KeyP': input.pause = true; break;
      case 'Space': input.start = true; e.preventDefault(); break;
      default: break;
    }
  };
  const up = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.up = false; break;
      case 'KeyS': case 'ArrowDown': input.down = false; break;
      case 'KeyA': case 'ArrowLeft': input.left = false; break;
      case 'KeyD': case 'ArrowRight': input.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': input.sprint = false; break;
      case 'KeyE': input.crack = false; break;
      case 'KeyQ': input.emp = false; break;
      case 'KeyF': input.smoke = false; break;
      case 'KeyP': input.pause = false; break;
      case 'Space': input.start = false; break;
      default: break;
    }
  };
  const pointer = (e) => {
    const rect = element.getBoundingClientRect();
    const scaleX = element.width / rect.width;
    const scaleY = element.height / rect.height;
    input.clickX = (e.clientX - rect.left) * scaleX;
    input.clickY = (e.clientY - rect.top) * scaleY;
    input.mouseX = input.clickX;
    input.mouseY = input.clickY;
    input.hasClick = true;
    input.start = true;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  element.addEventListener('pointerdown', pointer);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    element.removeEventListener('pointerdown', pointer);
  };
}
