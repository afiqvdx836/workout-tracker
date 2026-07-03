/* ============================================
   FitPulse — Workout Tracker App
   ============================================ */

// --- Exercise Definitions ---
const EXERCISES = [
  { id: 'pushups', name: 'Push-ups', icon: '🫸', category: 'upper' },
  { id: 'pullups', name: 'Pull-ups', icon: '🏋️', category: 'upper' },
  { id: 'squats', name: 'Squats', icon: '🦵', category: 'lower' },
  { id: 'situps', name: 'Sit-ups', icon: '🧘', category: 'core' },
  { id: 'dips', name: 'Dips', icon: '💪', category: 'upper' },
  { id: 'lunges', name: 'Lunges', icon: '🚶', category: 'lower' },
  { id: 'burpees', name: 'Burpees', icon: '⚡', category: 'full' },
  { id: 'plank', name: 'Plank (sec)', icon: '🧱', category: 'core' },
  { id: 'jumpingjacks', name: 'Jumping Jacks', icon: '⭐', category: 'cardio' },
  { id: 'mountainclimbers', name: 'Mountain Climbers', icon: '🧗', category: 'cardio' },
  { id: 'bicepscurl', name: 'Biceps Curl', icon: '💪', category: 'upper' },
  { id: 'shoulderpress', name: 'Shoulder Press', icon: '🤸', category: 'upper' },
];

// --- Storage Keys ---
const STORAGE_KEY = 'fitpulse_workouts';
const ACTIVE_WORKOUT_KEY = 'fitpulse_active_workout';

// --- App State ---
const state = {
  currentScreen: 'home',
  activeWorkout: null,
  workouts: [],
  selectedExercise: null,
  currentReps: 0,
  workoutTimerInterval: null,
  workoutStartTime: null,
  workoutElapsedMs: 0,
  restTimerInterval: null,
  restDuration: 60,
  restRemaining: 60,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  chartFilter: 'reps',

  // Camera & AI State
  cameraActive: false,
  cameraStream: null,
  poseLandmarker: null,
  lastVideoTime: -1,
  cameraMirrored: true,
  voiceFeedbackEnabled: true,
  
  // Rep Counter state machines
  repDetector: {
    state: 'UP',
    lastAngle: null,
    cooldown: 0,
  },
  
  // Recording state
  recordingActive: false,
  mediaRecorder: null,
  recordedChunks: [],
  recordingStartTime: null,
  recordingTimerInterval: null,
};

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadWorkouts();
  initNavigation();
  initExerciseChips();
  initRepCounter();
  initRestTimer();
  initCalendar();
  initChart();
  initModals();
  initCameraUI();
  updateGreeting();
  updateHomeStats();
  updateRecentWorkouts();
  restoreActiveWorkout();
});

// ============================================
// STORAGE
// ============================================

function loadWorkouts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    state.workouts = data ? JSON.parse(data) : [];
  } catch (e) {
    state.workouts = [];
  }
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workouts));
}

function saveActiveWorkout() {
  if (state.activeWorkout) {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({
      workout: state.activeWorkout,
      startTime: state.workoutStartTime,
      elapsed: state.workoutElapsedMs,
    }));
  } else {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  }
}

function restoreActiveWorkout() {
  try {
    const data = localStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      state.activeWorkout = parsed.workout;
      state.workoutStartTime = parsed.startTime;
      state.workoutElapsedMs = parsed.elapsed || 0;
      navigateTo('workout');
      startWorkoutTimer();
      renderActiveWorkout();
    }
  } catch (e) {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  }
}

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen === 'workout' && !state.activeWorkout) {
        showToast('💡', 'Start a workout first!');
        return;
      }
      navigateTo(screen);
    });
  });
}

function navigateTo(screenId) {
  state.currentScreen = screenId;

  // Update screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Screen-specific updates
  if (screenId === 'history') {
    renderCalendar();
    renderHistoryList();
  } else if (screenId === 'stats') {
    updateStatsScreen();
    renderChart();
  } else if (screenId === 'home') {
    updateHomeStats();
    updateRecentWorkouts();
  }
}

// ============================================
// HOME SCREEN
// ============================================

function updateGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  document.getElementById('greeting-text').textContent = greeting;
}

function updateHomeStats() {
  const today = new Date().toDateString();
  const todayWorkouts = state.workouts.filter(w => new Date(w.completedAt).toDateString() === today);
  
  let totalReps = 0;
  let totalSets = 0;
  todayWorkouts.forEach(w => {
    w.exercises.forEach(ex => {
      ex.sets.forEach(s => { totalReps += s.reps; });
      totalSets += ex.sets.length;
    });
  });

  document.getElementById('today-workouts').textContent = todayWorkouts.length;
  document.getElementById('today-reps').textContent = totalReps;
  document.getElementById('today-sets').textContent = totalSets;
}

function updateRecentWorkouts() {
  const container = document.getElementById('recent-workouts');
  const recent = state.workouts.slice(-5).reverse();

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏋️</div>
        <div class="empty-state-title">No workouts yet</div>
        <div class="empty-state-text">Start your first workout to see your progress here!</div>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(w => {
    const date = formatDate(w.completedAt);
    const totalReps = w.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0);
    const exerciseNames = w.exercises.map(ex => ex.name).join(', ');
    return `
      <div class="recent-workout-item" data-id="${w.id}">
        <div class="recent-workout-info">
          <div class="recent-workout-date">${date}</div>
          <div class="recent-workout-summary">${exerciseNames}</div>
        </div>
        <div class="recent-workout-reps">${totalReps} reps</div>
      </div>`;
  }).join('');

  // Add click handlers to open detail modal
  container.querySelectorAll('.recent-workout-item').forEach(item => {
    item.addEventListener('click', () => openWorkoutDetail(item.dataset.id));
  });
}

// ============================================
// WORKOUT ENGINE
// ============================================

document.getElementById('btn-start-workout').addEventListener('click', startNewWorkout);

function startNewWorkout() {
  state.activeWorkout = {
    id: generateId(),
    date: new Date().toISOString(),
    exercises: [],
    completedAt: null,
    duration: 0,
  };
  state.selectedExercise = null;
  state.currentReps = 0;
  state.workoutStartTime = Date.now();
  state.workoutElapsedMs = 0;

  startWorkoutTimer();
  saveActiveWorkout();
  navigateTo('workout');
  renderActiveWorkout();
  showToast('🔥', 'Workout started! Choose an exercise.');
}

function startWorkoutTimer() {
  stopWorkoutTimer();
  const baseTime = state.workoutStartTime || Date.now();
  const baseElapsed = state.workoutElapsedMs || 0;
  
  state.workoutTimerInterval = setInterval(() => {
    const elapsed = baseElapsed + (Date.now() - baseTime);
    document.getElementById('workout-timer-value').textContent = formatTime(elapsed);
  }, 1000);
  
  // Update immediately
  const elapsed = baseElapsed + (Date.now() - baseTime);
  document.getElementById('workout-timer-value').textContent = formatTime(elapsed);
}

function stopWorkoutTimer() {
  if (state.workoutTimerInterval) {
    clearInterval(state.workoutTimerInterval);
    state.workoutTimerInterval = null;
  }
}

function getWorkoutDuration() {
  if (!state.workoutStartTime) return 0;
  return state.workoutElapsedMs + (Date.now() - state.workoutStartTime);
}

function renderActiveWorkout() {
  // Show/hide rep counter
  const repSection = document.getElementById('rep-counter-section');
  const restBtn = document.getElementById('btn-rest-timer');

  if (state.selectedExercise) {
    repSection.classList.remove('hidden');
    restBtn.classList.remove('hidden');
    document.getElementById('current-exercise-name').textContent = state.selectedExercise.name;
    document.querySelector('.exercise-current-icon').textContent = state.selectedExercise.icon;
    document.getElementById('rep-count').textContent = state.currentReps;
    renderSets();
  } else {
    repSection.classList.add('hidden');
    restBtn.classList.add('hidden');
  }

  // Update exercise chips
  document.querySelectorAll('.exercise-chip').forEach(chip => {
    chip.classList.toggle('selected', state.selectedExercise && chip.dataset.id === state.selectedExercise.id);
  });

  // Render done exercises
  renderDoneExercises();
}

function renderSets() {
  const container = document.getElementById('sets-list');
  const setsTitle = document.getElementById('sets-title');
  
  if (!state.selectedExercise || !state.activeWorkout) {
    container.innerHTML = '';
    return;
  }

  const exerciseData = state.activeWorkout.exercises.find(e => e.id === state.selectedExercise.id);
  const sets = exerciseData ? exerciseData.sets : [];
  setsTitle.textContent = `Sets completed (${sets.length})`;

  if (sets.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = sets.map((set, i) => `
    <div class="set-item">
      <span class="set-number">Set ${i + 1}</span>
      <span class="set-reps">${set.reps} reps</span>
      <span class="set-time">${formatTimeShort(set.timestamp)}</span>
    </div>
  `).join('');
}

function renderDoneExercises() {
  const container = document.getElementById('workout-exercises-done');
  if (!state.activeWorkout || state.activeWorkout.exercises.length === 0) {
    container.innerHTML = '';
    return;
  }

  const exercisesHtml = state.activeWorkout.exercises
    .filter(e => e.sets.length > 0)
    .map(e => {
      const totalReps = e.sets.reduce((sum, s) => sum + s.reps, 0);
      const isSelected = state.selectedExercise && state.selectedExercise.id === e.id;
      return `
        <div class="done-exercise-item" style="${isSelected ? 'border-color: var(--border-active);' : ''}">
          <div class="done-exercise-name">${e.icon} ${e.name}</div>
          <div class="done-exercise-stats">${e.sets.length} sets · ${totalReps} reps</div>
        </div>`;
    }).join('');

  if (exercisesHtml) {
    container.innerHTML = `
      <div class="section-title" style="margin-bottom: 8px; margin-top: 8px;">Exercises in this workout</div>
      ${exercisesHtml}`;
  } else {
    container.innerHTML = '';
  }
}

// --- Exercise Chips ---
function initExerciseChips() {
  const container = document.getElementById('exercise-chips');
  container.innerHTML = EXERCISES.map(ex => `
    <button class="exercise-chip" data-id="${ex.id}">
      <span class="chip-icon">${ex.icon}</span>
      ${ex.name}
    </button>
  `).join('');

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.exercise-chip');
    if (!chip || !state.activeWorkout) return;

    const exercise = EXERCISES.find(ex => ex.id === chip.dataset.id);
    if (!exercise) return;

    selectExercise(exercise);
  });
}

function selectExercise(exercise) {
  state.selectedExercise = exercise;
  state.currentReps = 0;

  // Ensure exercise exists in workout
  if (!state.activeWorkout.exercises.find(e => e.id === exercise.id)) {
    state.activeWorkout.exercises.push({
      id: exercise.id,
      name: exercise.name,
      icon: exercise.icon,
      sets: [],
    });
  }

  // Reset the rep detector state machine for the new exercise
  resetRepDetectorState();

  renderActiveWorkout();
  hapticFeedback();
}

// --- Rep Counter ---
function initRepCounter() {
  document.getElementById('btn-rep-plus').addEventListener('click', () => {
    state.currentReps++;
    updateRepDisplay(true);
    hapticFeedback();
  });

  document.getElementById('btn-rep-minus').addEventListener('click', () => {
    if (state.currentReps > 0) {
      state.currentReps--;
      updateRepDisplay(false);
      hapticFeedback();
    }
  });

  document.getElementById('btn-rep-reset').addEventListener('click', () => {
    state.currentReps = 0;
    updateRepDisplay(false);
  });

  document.getElementById('btn-complete-set').addEventListener('click', completeSet);
}

function updateRepDisplay(animate) {
  const repEl = document.getElementById('rep-count');
  repEl.textContent = state.currentReps;
  
  if (animate) {
    repEl.classList.remove('bump');
    // Force reflow
    void repEl.offsetWidth;
    repEl.classList.add('bump');
  }
}

function completeSet() {
  if (!state.selectedExercise || !state.activeWorkout || state.currentReps === 0) {
    if (state.currentReps === 0) {
      showToast('⚠️', 'Add some reps first!');
    }
    return;
  }

  const exercise = state.activeWorkout.exercises.find(e => e.id === state.selectedExercise.id);
  if (!exercise) return;

  exercise.sets.push({
    reps: state.currentReps,
    timestamp: new Date().toISOString(),
  });

  const completedReps = state.currentReps;
  state.currentReps = 0;
  updateRepDisplay(false);
  renderActiveWorkout();
  saveActiveWorkout();
  showToast('✅', `Set completed! ${completedReps} reps`);
  hapticFeedback();

  // Show rest timer overlay
  showRestTimer();
}

// --- Finish Workout ---
document.getElementById('btn-finish-workout').addEventListener('click', () => {
  if (!state.activeWorkout) return;
  
  const hasExercises = state.activeWorkout.exercises.some(e => e.sets.length > 0);
  if (!hasExercises) {
    showConfirm(
      '🤔',
      'No exercises logged',
      'You haven\'t completed any sets. Discard this workout?',
      () => {
        discardWorkout();
      }
    );
    return;
  }

  showConfirm(
    '🏁',
    'Finish Workout?',
    'Great job! Save this workout to your history?',
    () => {
      finishWorkout();
    }
  );
});

function finishWorkout() {
  if (!state.activeWorkout) return;

  const duration = getWorkoutDuration();
  state.activeWorkout.duration = duration;
  state.activeWorkout.completedAt = new Date().toISOString();
  
  // Remove exercises with no sets
  state.activeWorkout.exercises = state.activeWorkout.exercises.filter(e => e.sets.length > 0);

  state.workouts.push(state.activeWorkout);
  saveWorkouts();

  const totalReps = state.activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0
  );

  cleanupWorkout();
  navigateTo('home');
  showToast('🎉', `Workout saved! ${totalReps} total reps`);
}

function discardWorkout() {
  cleanupWorkout();
  navigateTo('home');
  showToast('🗑️', 'Workout discarded');
}

function cleanupWorkout() {
  stopWorkoutTimer();
  stopCamera();
  state.activeWorkout = null;
  state.selectedExercise = null;
  state.currentReps = 0;
  state.workoutStartTime = null;
  state.workoutElapsedMs = 0;
  localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  document.getElementById('workout-timer-value').textContent = '00:00';
}

// ============================================
// REST TIMER
// ============================================

function initRestTimer() {
  document.getElementById('btn-rest-timer').addEventListener('click', showRestTimer);
  document.getElementById('btn-rest-skip').addEventListener('click', hideRestTimer);
  document.getElementById('btn-rest-start').addEventListener('click', toggleRestTimer);

  // Presets
  document.getElementById('rest-presets').addEventListener('click', (e) => {
    const btn = e.target.closest('.rest-preset-btn');
    if (!btn) return;
    
    const seconds = parseInt(btn.dataset.seconds);
    state.restDuration = seconds;
    state.restRemaining = seconds;
    
    document.querySelectorAll('.rest-preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    updateRestDisplay();
    resetRestProgress();
  });
}

function showRestTimer() {
  state.restRemaining = state.restDuration;
  updateRestDisplay();
  resetRestProgress();
  document.getElementById('rest-timer-overlay').classList.add('active');
  document.getElementById('btn-rest-start').textContent = 'Start Rest';
}

function hideRestTimer() {
  clearInterval(state.restTimerInterval);
  state.restTimerInterval = null;
  document.getElementById('rest-timer-overlay').classList.remove('active');
}

function toggleRestTimer() {
  const btn = document.getElementById('btn-rest-start');
  
  if (state.restTimerInterval) {
    // Pause
    clearInterval(state.restTimerInterval);
    state.restTimerInterval = null;
    btn.textContent = 'Resume';
    return;
  }

  // Start
  btn.textContent = 'Pause';
  const circumference = 2 * Math.PI * 100;
  const totalDuration = state.restDuration;

  state.restTimerInterval = setInterval(() => {
    state.restRemaining--;
    updateRestDisplay();

    // Update progress ring
    const progress = 1 - (state.restRemaining / totalDuration);
    const offset = circumference * progress;
    document.getElementById('rest-progress').style.strokeDashoffset = offset;

    if (state.restRemaining <= 0) {
      clearInterval(state.restTimerInterval);
      state.restTimerInterval = null;
      hapticFeedback();
      showToast('⏰', 'Rest time is up! Get back to it!');
      setTimeout(hideRestTimer, 1000);
    }
  }, 1000);
}

function updateRestDisplay() {
  const min = Math.floor(state.restRemaining / 60);
  const sec = state.restRemaining % 60;
  document.getElementById('rest-time-display').textContent =
    `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function resetRestProgress() {
  document.getElementById('rest-progress').style.strokeDashoffset = '0';
}

// ============================================
// HISTORY SCREEN
// ============================================

function initCalendar() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    state.calendarMonth--;
    if (state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear--;
    }
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    state.calendarMonth++;
    if (state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear++;
    }
    renderCalendar();
  });
}

function renderCalendar() {
  const year = state.calendarYear;
  const month = state.calendarMonth;
  const today = new Date();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('cal-month').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get workout dates for this month
  const workoutDates = new Set();
  state.workouts.forEach(w => {
    const d = new Date(w.completedAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      workoutDates.add(d.getDate());
    }
  });

  let html = '';
  
  // Empty cells for days before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const hasWorkout = workoutDates.has(day);
    const classes = ['calendar-day'];
    if (isToday) classes.push('today');
    if (hasWorkout) classes.push('has-workout');
    html += `<div class="${classes.join(' ')}">${day}</div>`;
  }

  document.getElementById('cal-days').innerHTML = html;
}

function renderHistoryList() {
  const container = document.getElementById('history-list');
  const workouts = [...state.workouts].reverse();

  if (workouts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No history yet</div>
        <div class="empty-state-text">Complete your first workout to start tracking your journey.</div>
      </div>`;
    return;
  }

  container.innerHTML = workouts.map(w => {
    const totalReps = w.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0);
    const totalSets = w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const duration = formatTime(w.duration);
    const date = formatDate(w.completedAt);

    return `
      <div class="history-item" data-id="${w.id}">
        <div class="history-item-header">
          <span class="history-date">${date}</span>
          <div class="flex-row">
            <span class="history-duration">⏱️ ${duration}</span>
            <button class="history-delete-btn" data-delete-id="${w.id}" title="Delete workout">✕</button>
          </div>
        </div>
        <div class="history-exercises">
          ${w.exercises.map(ex => `<span class="history-exercise-tag">${ex.icon} ${ex.name}</span>`).join('')}
        </div>
        <div class="history-stats">
          <span class="history-stat"><strong>${totalReps}</strong> reps</span>
          <span class="history-stat"><strong>${totalSets}</strong> sets</span>
          <span class="history-stat"><strong>${w.exercises.length}</strong> exercises</span>
        </div>
      </div>`;
  }).join('');

  // Click to view details
  container.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete-btn')) return;
      openWorkoutDetail(item.dataset.id);
    });
  });

  // Delete buttons
  container.querySelectorAll('.history-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      showConfirm('🗑️', 'Delete Workout?', 'This action cannot be undone.', () => {
        state.workouts = state.workouts.filter(w => w.id !== id);
        saveWorkouts();
        renderHistoryList();
        renderCalendar();
        showToast('🗑️', 'Workout deleted');
      });
    });
  });
}

// ============================================
// WORKOUT DETAIL MODAL
// ============================================

function initModals() {
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('workout-detail-modal').classList.remove('active');
  });

  document.getElementById('workout-detail-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('workout-detail-modal').classList.remove('active');
    }
  });
}

function openWorkoutDetail(workoutId) {
  const workout = state.workouts.find(w => w.id === workoutId);
  if (!workout) return;

  const date = formatDate(workout.completedAt);
  const duration = formatTime(workout.duration);
  document.getElementById('modal-title').textContent = `${date} · ${duration}`;

  const container = document.getElementById('modal-exercises');
  container.innerHTML = workout.exercises.map(ex => {
    const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
    return `
      <div class="modal-exercise-item">
        <div class="modal-exercise-name">${ex.icon} ${ex.name} <span style="color: var(--text-tertiary); font-weight: 400; font-size: 0.85rem;">(${totalReps} total reps)</span></div>
        <div class="modal-sets-list">
          ${ex.sets.map((s, i) => `
            <div class="modal-set-row">
              <span>Set ${i + 1}</span>
              <span>${s.reps} reps</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  document.getElementById('workout-detail-modal').classList.add('active');
}

// ============================================
// STATS SCREEN
// ============================================

function updateStatsScreen() {
  const totalWorkouts = state.workouts.length;
  let totalReps = 0;
  let totalSets = 0;
  let totalTimeMs = 0;

  state.workouts.forEach(w => {
    totalTimeMs += w.duration || 0;
    w.exercises.forEach(ex => {
      totalSets += ex.sets.length;
      ex.sets.forEach(s => { totalReps += s.reps; });
    });
  });

  document.getElementById('stats-total-workouts').textContent = totalWorkouts;
  document.getElementById('stats-total-reps').textContent = totalReps.toLocaleString();
  document.getElementById('stats-total-sets').textContent = totalSets;
  document.getElementById('stats-total-time').textContent = formatDurationShort(totalTimeMs);

  // Personal records
  renderPersonalRecords();
}

function renderPersonalRecords() {
  const container = document.getElementById('pr-list');
  const exerciseStats = {};

  state.workouts.forEach(w => {
    w.exercises.forEach(ex => {
      if (!exerciseStats[ex.id]) {
        exerciseStats[ex.id] = {
          name: ex.name,
          icon: ex.icon,
          maxReps: 0,
          totalReps: 0,
          totalSets: 0,
        };
      }
      ex.sets.forEach(s => {
        exerciseStats[ex.id].totalReps += s.reps;
        exerciseStats[ex.id].totalSets++;
        if (s.reps > exerciseStats[ex.id].maxReps) {
          exerciseStats[ex.id].maxReps = s.reps;
        }
      });
    });
  });

  const entries = Object.values(exerciseStats).sort((a, b) => b.totalReps - a.totalReps);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <div class="empty-state-title">No records yet</div>
        <div class="empty-state-text">Complete workouts to set personal records!</div>
      </div>`;
    return;
  }

  container.innerHTML = entries.map(ex => `
    <div class="pr-item">
      <div class="pr-exercise">
        <div class="pr-exercise-icon">${ex.icon}</div>
        <div>
          <div class="pr-exercise-name">${ex.name}</div>
          <div class="pr-exercise-total">${ex.totalReps} total · ${ex.totalSets} sets</div>
        </div>
      </div>
      <div class="pr-value">
        <div class="pr-max">${ex.maxReps}</div>
        <div class="pr-label">Best Set</div>
      </div>
    </div>
  `).join('');
}

// ============================================
// CHART
// ============================================

function initChart() {
  document.getElementById('chart-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.chart-filter-btn');
    if (!btn) return;
    
    state.chartFilter = btn.dataset.filter;
    document.querySelectorAll('.chart-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChart();
  });
}

function renderChart() {
  const canvas = document.getElementById('progress-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Get last 7 days of data
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();
    
    const dayWorkouts = state.workouts.filter(w => new Date(w.completedAt).toDateString() === dateStr);
    let value = 0;
    dayWorkouts.forEach(w => {
      w.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          if (state.chartFilter === 'reps') {
            value += s.reps;
          }
        });
        if (state.chartFilter === 'sets') {
          value += ex.sets.length;
        }
      });
    });

    days.push({
      label: dayNames[date.getDay()],
      value,
      isToday: i === 0,
    });
  }

  const maxValue = Math.max(...days.map(d => d.value), 1);
  const padding = { top: 20, bottom: 35, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / days.length;

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Draw bars
  days.forEach((day, i) => {
    const x = padding.left + i * barWidth + barWidth * 0.2;
    const w = barWidth * 0.6;
    const barHeight = day.value > 0 ? (day.value / maxValue) * chartHeight : 0;
    const y = padding.top + chartHeight - barHeight;

    // Bar
    if (day.value > 0) {
      const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartHeight);
      gradient.addColorStop(0, day.isToday ? '#4f8cff' : 'rgba(79, 140, 255, 0.6)');
      gradient.addColorStop(1, day.isToday ? '#00d4ff' : 'rgba(0, 212, 255, 0.3)');
      
      // Rounded bar
      const radius = Math.min(w / 2, 6);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, padding.top + chartHeight);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Value label
      if (day.value > 0) {
        ctx.fillStyle = day.isToday ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(day.value, x + w / 2, y - 6);
      }
    } else {
      // Empty dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(x + w / 2, padding.top + chartHeight - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Day label
    ctx.fillStyle = day.isToday ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.font = `${day.isToday ? '600' : '400'} 11px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(day.label, x + w / 2, height - padding.bottom + 20);
  });
}

// ============================================
// CONFIRM DIALOG
// ============================================

let confirmCallback = null;

function showConfirm(icon, title, text, onConfirm) {
  document.getElementById('confirm-icon').textContent = icon;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  confirmCallback = onConfirm;
  document.getElementById('confirm-overlay').classList.add('active');
}

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  document.getElementById('confirm-overlay').classList.remove('active');
  confirmCallback = null;
});

document.getElementById('btn-confirm-ok').addEventListener('click', () => {
  document.getElementById('confirm-overlay').classList.remove('active');
  if (confirmCallback) {
    confirmCallback();
    confirmCallback = null;
  }
});

// ============================================
// TOAST
// ============================================

let toastTimeout = null;

function showToast(icon, text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-text').textContent = text;

  clearTimeout(toastTimeout);
  toast.classList.remove('show');
  
  // Force reflow
  void toast.offsetWidth;
  
  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// ============================================
// UTILITIES
// ============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTimeShort(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDurationShort(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}h ${mins}m`;
}

function hapticFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

// --- Handle window resize for chart ---
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (state.currentScreen === 'stats') {
      renderChart();
    }
  }, 200);
});

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Service worker registration failed — app still works
    });
  });
}

// ============================================
// CAMERA AI & WORKOUT RECORDING SYSTEM
// ============================================

function initCameraUI() {
  const btnCameraToggle = document.getElementById('btn-camera-toggle');
  const btnRecordToggle = document.getElementById('btn-record-toggle');
  const btnCameraFlip = document.getElementById('btn-camera-flip');
  const btnVoiceToggle = document.getElementById('btn-voice-toggle');

  if (btnCameraToggle) {
    btnCameraToggle.addEventListener('click', toggleCamera);
  }
  if (btnRecordToggle) {
    btnRecordToggle.addEventListener('click', toggleRecording);
  }
  if (btnCameraFlip) {
    btnCameraFlip.addEventListener('click', flipCamera);
  }
  if (btnVoiceToggle) {
    btnVoiceToggle.addEventListener('click', toggleVoiceFeedback);
  }
}

async function toggleCamera() {
  if (state.cameraActive) {
    await stopCamera();
  } else {
    await startCamera();
  }
}

async function loadPoseModel() {
  if (state.poseLandmarker) return;

  try {
    const statusEl = document.getElementById('camera-status');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.style.opacity = '1';
      statusEl.textContent = 'Loading AI Pose Model...';
    }
    
    // Dynamic import of Tasks-Vision library from CDN
    const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs");
    const { PoseLandmarker, FilesetResolver } = visionModule;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );

    state.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });

    console.log("Pose Model Loaded successfully.");
  } catch (error) {
    console.error("Error loading Pose Model:", error);
    const statusEl = document.getElementById('camera-status');
    if (statusEl) {
      statusEl.textContent = 'Error loading Pose Model. Check connection.';
    }
    throw error;
  }
}

async function startCamera() {
  const container = document.getElementById('camera-stream-container');
  const statusEl = document.getElementById('camera-status');
  const videoEl = document.getElementById('webcam');
  const btnText = document.getElementById('camera-btn-text');
  const btnRecord = document.getElementById('btn-record-toggle');
  const btnFlip = document.getElementById('btn-camera-flip');

  if (!container || !videoEl) return;

  container.classList.remove('hidden');
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.style.opacity = '1';
    statusEl.textContent = 'Accessing camera...';
  }

  try {
    // Request webcam stream with audio (fall back to video-only if audio fails)
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true }
      });
    } catch (e) {
      console.warn("Audio camera capture failed, falling back to video only", e);
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
    }

    videoEl.srcObject = state.cameraStream;
    
    await new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        resolve();
      };
    });

    state.cameraActive = true;
    if (btnText) btnText.textContent = 'Stop Camera';
    if (btnRecord) btnRecord.classList.remove('hidden');
    if (btnFlip) btnFlip.classList.remove('hidden');

    // Load pose AI model
    await loadPoseModel();
    
    // Hide status overlay upon success
    if (statusEl) {
      statusEl.style.opacity = '0';
      setTimeout(() => {
        if (statusEl.style.opacity === '0') {
          statusEl.classList.add('hidden');
        }
      }, 300);
    }

    // Set canvas resolution
    resizePoseCanvas();
    
    // Setup exercise-specific detection state
    resetRepDetectorState();

    // Start rendering frame loop
    state.lastVideoTime = -1;
    requestAnimationFrame(poseDetectionLoop);

  } catch (error) {
    console.error("Camera startup error:", error);
    if (statusEl) {
      statusEl.textContent = 'Camera Access Denied or Pose Error.';
    }
    showToast('⚠️', 'Camera access failed or Pose model error.');
    stopCamera();
  }
}

async function stopCamera() {
  if (state.recordingActive) {
    stopRecording();
  }

  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }

  const videoEl = document.getElementById('webcam');
  if (videoEl) {
    videoEl.srcObject = null;
  }

  state.cameraActive = false;
  
  const container = document.getElementById('camera-stream-container');
  const btnText = document.getElementById('camera-btn-text');
  const btnRecord = document.getElementById('btn-record-toggle');
  const btnFlip = document.getElementById('btn-camera-flip');
  const statusEl = document.getElementById('camera-status');

  if (container) container.classList.add('hidden');
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.style.opacity = '1';
    statusEl.textContent = 'Camera stopped';
  }
  if (btnText) btnText.textContent = 'Start Camera';
  if (btnRecord) btnRecord.classList.add('hidden');
  if (btnFlip) btnFlip.classList.add('hidden');
}

function resizePoseCanvas() {
  const videoEl = document.getElementById('webcam');
  const canvasEl = document.getElementById('pose-canvas');
  if (videoEl && canvasEl && state.cameraActive) {
    canvasEl.width = videoEl.videoWidth || videoEl.clientWidth || 640;
    canvasEl.height = videoEl.videoHeight || videoEl.clientHeight || 480;
  }
}

window.addEventListener('resize', resizePoseCanvas);

function poseDetectionLoop(timestamp) {
  if (!state.cameraActive) return;

  const videoEl = document.getElementById('webcam');
  const canvasEl = document.getElementById('pose-canvas');
  
  if (videoEl && canvasEl && videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
    if (videoEl.currentTime !== state.lastVideoTime) {
      state.lastVideoTime = videoEl.currentTime;
      
      let results = null;
      if (state.poseLandmarker) {
        results = state.poseLandmarker.detectForVideo(videoEl, timestamp);
      }
      
      drawPose(results);
      if (results) {
        processPoseResults(results);
      }
    }
  }

  requestAnimationFrame(poseDetectionLoop);
}

function drawPose(results) {
  const canvasEl = document.getElementById('pose-canvas');
  const videoEl = document.getElementById('webcam');
  if (!canvasEl || !videoEl) return;
  
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  // 1. Draw frame (supporting real-time canvas-based mirror scaling)
  ctx.save();
  if (state.cameraMirrored) {
    ctx.translate(canvasEl.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  } else {
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  }
  ctx.restore();

  // 2. Draw HUD HUD/text overlay (always visible)
  drawExerciseOverlay(ctx, canvasEl, results ? results.landmarks?.[0] : null, getCanvasCoords);

  if (!results || !results.landmarks || results.landmarks.length === 0) {
    return;
  }

  const landmarks = results.landmarks[0];
  const minVisibility = 0.25;

  // Mirror coordinate mapper helper
  function getCanvasCoords(landmark) {
    let x = landmark.x;
    if (state.cameraMirrored) {
      x = 1 - x;
    }
    return {
      x: x * canvasEl.width,
      y: landmark.y * canvasEl.height
    };
  }

  // 3. Draw Skeleton lines
  const CONNECTIONS = [
    [11, 12], // shoulders
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], [23, 24], // trunk
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28]  // right leg
  ];

  CONNECTIONS.forEach(([i1, i2]) => {
    const p1 = landmarks[i1];
    const p2 = landmarks[i2];
    
    if (p1 && p2 && (p1.visibility || 0) > minVisibility && (p2.visibility || 0) > minVisibility) {
      const c1 = getCanvasCoords(p1);
      const c2 = getCanvasCoords(p2);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.65)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  });

  // 4. Draw Joint nodes
  const mainJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  landmarks.forEach((p, index) => {
    if (mainJoints.includes(index) && (p.visibility || 0) > minVisibility) {
      const c = getCanvasCoords(p);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#4f8cff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

function drawExerciseOverlay(ctx, canvas, landmarks, getCanvasCoords) {
  if (!state.selectedExercise) return;

  const exId = state.selectedExercise.id;
  
  // HUD Status Display Panel
  ctx.fillStyle = 'rgba(10, 10, 26, 0.75)';
  ctx.fillRect(12, 12, 180, 52);
  ctx.strokeStyle = 'rgba(79, 140, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, 180, 52);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '500 10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${state.selectedExercise.name.toUpperCase()} AI HUD`, 20, 20);

  ctx.fillStyle = '#00d4ff';
  ctx.font = 'bold 13px Inter, sans-serif';
  
  const isTargetEx = ['pushups', 'pullups', 'situps'].includes(exId);
  const displayState = isTargetEx ? `STATE: ${state.repDetector.state}` : 'MANUAL MODE';
  ctx.fillText(displayState, 20, 36);

  if (!landmarks || !isTargetEx || !getCanvasCoords) return;

  let side, angle, centerJoint;
  
  if (exId === 'pushups' || exId === 'pullups') {
    side = getBestSide(landmarks, 'elbow');
    if (!side) return;
    
    if (side === 'left') {
      angle = calculateAngle2D(landmarks[11], landmarks[13], landmarks[15]);
      centerJoint = landmarks[13];
    } else {
      angle = calculateAngle2D(landmarks[12], landmarks[14], landmarks[16]);
      centerJoint = landmarks[14];
    }
  } else if (exId === 'situps') {
    side = getBestSide(landmarks, 'hip');
    if (!side) return;
    
    if (side === 'left') {
      angle = calculateAngle2D(landmarks[11], landmarks[23], landmarks[25]);
      centerJoint = landmarks[23];
    } else {
      angle = calculateAngle2D(landmarks[12], landmarks[24], landmarks[26]);
      centerJoint = landmarks[24];
    }
  }

  if (centerJoint && angle) {
    const c = getCanvasCoords(centerJoint);

    // Render floating angle tag close to the joint
    ctx.beginPath();
    ctx.arc(c.x, c.y - 25, 20, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(angle)}°`, c.x, c.y - 25);
  }
}

function calculateAngle2D(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  let angle = Math.acos(dotProduct / (mag1 * mag2));
  return angle * (180 / Math.PI);
}

function getBestSide(landmarks, type) {
  const minVisibility = 0.25;
  if (type === 'elbow') {
    const leftVis = ((landmarks[11]?.visibility || 0) + (landmarks[13]?.visibility || 0) + (landmarks[15]?.visibility || 0)) / 3;
    const rightVis = ((landmarks[12]?.visibility || 0) + (landmarks[14]?.visibility || 0) + (landmarks[16]?.visibility || 0)) / 3;
    if (leftVis < minVisibility && rightVis < minVisibility) return null;
    return leftVis > rightVis ? 'left' : 'right';
  } else if (type === 'hip') {
    const leftVis = ((landmarks[11]?.visibility || 0) + (landmarks[23]?.visibility || 0) + (landmarks[25]?.visibility || 0)) / 3;
    const rightVis = ((landmarks[12]?.visibility || 0) + (landmarks[24]?.visibility || 0) + (landmarks[26]?.visibility || 0)) / 3;
    if (leftVis < minVisibility && rightVis < minVisibility) return null;
    return leftVis > rightVis ? 'left' : 'right';
  }
  return null;
}

function processPoseResults(results) {
  if (!state.selectedExercise || !results || !results.landmarks || results.landmarks.length === 0) {
    return;
  }

  const landmarks = results.landmarks[0];
  const exId = state.selectedExercise.id;

  if (exId !== 'pushups' && exId !== 'pullups' && exId !== 'situps') {
    return;
  }

  // Rate limit repetitions using structural cooldown
  if (state.repDetector.cooldown > 0) {
    state.repDetector.cooldown--;
    return;
  }

  let side, angle;

  if (exId === 'pushups' || exId === 'pullups') {
    side = getBestSide(landmarks, 'elbow');
    if (!side) return;
    
    if (side === 'left') {
      angle = calculateAngle2D(landmarks[11], landmarks[13], landmarks[15]);
    } else {
      angle = calculateAngle2D(landmarks[12], landmarks[14], landmarks[16]);
    }
  } else if (exId === 'situps') {
    side = getBestSide(landmarks, 'hip');
    if (!side) return;
    
    if (side === 'left') {
      angle = calculateAngle2D(landmarks[11], landmarks[23], landmarks[25]);
    } else {
      angle = calculateAngle2D(landmarks[12], landmarks[24], landmarks[26]);
    }
  }

  if (angle === undefined) return;

  const guideText = document.getElementById('camera-guide-text');

  if (exId === 'pushups') {
    // UP (elbow angle > 135) -> DOWN (elbow angle < 100) -> UP (elbow angle > 135)
    const flexThreshold = 100;
    const extendThreshold = 135;

    if (state.repDetector.state === 'UP') {
      if (angle < flexThreshold) {
        state.repDetector.state = 'DOWN';
        if (guideText) guideText.textContent = 'Push UP!';
        hapticFeedback();
      } else {
        if (guideText) guideText.textContent = 'Go LOWER!';
      }
    } else if (state.repDetector.state === 'DOWN') {
      if (angle > extendThreshold) {
        state.repDetector.state = 'UP';
        incrementRepCount();
        if (guideText) guideText.textContent = 'Great rep! Go down again.';
        state.repDetector.cooldown = 15; // rate limit frame checks
      }
    }
  } 
  
  else if (exId === 'pullups') {
    // DOWN (hanging, elbows straight > 135) -> UP (elbows bent < 95) -> DOWN
    const flexThreshold = 95;
    const extendThreshold = 135;

    if (state.repDetector.state === 'DOWN') {
      if (angle < flexThreshold) {
        state.repDetector.state = 'UP';
        if (guideText) guideText.textContent = 'Lower yourself down!';
        hapticFeedback();
      } else {
        if (guideText) guideText.textContent = 'Pull yourself UP!';
      }
    } else if (state.repDetector.state === 'UP') {
      if (angle > extendThreshold) {
        state.repDetector.state = 'DOWN';
        incrementRepCount();
        if (guideText) guideText.textContent = 'Perfect! Go up.';
        state.repDetector.cooldown = 15;
      }
    }
  } 
  
  else if (exId === 'situps') {
    // DOWN (lying, hip straight > 115) -> UP (sitting, hip flexed < 80) -> DOWN
    const flexThreshold = 80;
    const extendThreshold = 115;

    if (state.repDetector.state === 'DOWN') {
      if (angle < flexThreshold) {
        state.repDetector.state = 'UP';
        if (guideText) guideText.textContent = 'Lie back down slowly!';
        hapticFeedback();
      } else {
        if (guideText) guideText.textContent = 'Sit UP!';
      }
    } else if (state.repDetector.state === 'UP') {
      if (angle > extendThreshold) {
        state.repDetector.state = 'DOWN';
        incrementRepCount();
        if (guideText) guideText.textContent = 'Good sit-up! Keep going.';
        state.repDetector.cooldown = 20;
      }
    }
  }
}

function incrementRepCount() {
  state.currentReps++;
  updateRepDisplay(true);
  hapticFeedback();
  
  if (state.voiceFeedbackEnabled) {
    speakNumber(state.currentReps);
  }
}

function speakNumber(num) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(String(num));
    utterance.rate = 1.15;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

function resetRepDetectorState() {
  const guideText = document.getElementById('camera-guide-text');
  if (state.selectedExercise) {
    const exId = state.selectedExercise.id;
    if (exId === 'pushups') {
      state.repDetector.state = 'UP';
      if (guideText) guideText.textContent = 'Plank position. Go down to start.';
    } else if (exId === 'pullups') {
      state.repDetector.state = 'DOWN';
      if (guideText) guideText.textContent = 'Hang from the bar to start.';
    } else if (exId === 'situps') {
      state.repDetector.state = 'DOWN';
      if (guideText) guideText.textContent = 'Lie flat on your back to start.';
    } else {
      state.repDetector.state = 'UP';
      if (guideText) guideText.textContent = 'Position your camera to see your full body.';
    }
  }
  state.repDetector.cooldown = 0;
  state.repDetector.lastAngle = null;
}

function toggleRecording() {
  if (state.recordingActive) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  const canvasEl = document.getElementById('pose-canvas');
  if (!canvasEl || !state.cameraActive) return;

  state.recordedChunks = [];
  
  // Combine canvas video stream with microphone audio track if available
  const canvasStream = canvasEl.captureStream(30); // 30 FPS Capture
  const combinedStream = new MediaStream();
  
  canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
  
  if (state.cameraStream) {
    state.cameraStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
  }

  // Feature detect mime type support
  let options = {};
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    options = { mimeType: 'video/webm;codecs=vp9' };
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    options = { mimeType: 'video/webm;codecs=vp8' };
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    options = { mimeType: 'video/webm' };
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
    options = { mimeType: 'video/mp4' };
  }

  try {
    state.mediaRecorder = new MediaRecorder(combinedStream, options);
  } catch (e) {
    console.warn("Failed to create MediaRecorder with options, using default fallbacks.", e);
    state.mediaRecorder = new MediaRecorder(combinedStream);
  }

  state.mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      state.recordedChunks.push(event.data);
    }
  };

  state.mediaRecorder.onstop = saveRecording;

  state.mediaRecorder.start(1000); // chunk every 1 second
  state.recordingActive = true;
  state.recordingStartTime = Date.now();

  // Update UI Elements
  const recBtnText = document.getElementById('record-btn-text');
  if (recBtnText) recBtnText.textContent = 'Stop Recording';
  
  const recBadge = document.getElementById('rec-badge');
  if (recBadge) recBadge.classList.remove('hidden');
  
  updateRecordingDuration();
  state.recordingTimerInterval = setInterval(updateRecordingDuration, 1000);
  
  showToast('🔴', 'Session recording started!');
}

function stopRecording() {
  if (!state.recordingActive || !state.mediaRecorder) return;
  
  state.mediaRecorder.stop();
  state.recordingActive = false;
  
  clearInterval(state.recordingTimerInterval);
  state.recordingTimerInterval = null;
  
  const recBtnText = document.getElementById('record-btn-text');
  if (recBtnText) recBtnText.textContent = 'Record';
  
  const recBadge = document.getElementById('rec-badge');
  if (recBadge) recBadge.classList.add('hidden');
  
  showToast('💾', 'Recording stopped. Preparing download...');
}

function updateRecordingDuration() {
  const durationEl = document.getElementById('rec-duration');
  if (!durationEl || !state.recordingStartTime) return;
  
  const elapsed = Date.now() - state.recordingStartTime;
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  durationEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function saveRecording() {
  if (state.recordedChunks.length === 0) return;
  
  const mimeType = state.mediaRecorder.mimeType || 'video/webm';
  const blob = new Blob(state.recordedChunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  
  const dateStr = new Date().toISOString().split('T')[0];
  const exName = state.selectedExercise ? state.selectedExercise.id : 'workout';
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  
  a.download = `FitPulse_${exName}_${dateStr}.${ext}`;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);

  showToast('💾', 'Video saved to downloads!');
}

function flipCamera() {
  state.cameraMirrored = !state.cameraMirrored;
  showToast('🔄', state.cameraMirrored ? 'Camera Mirrored' : 'Camera Normal');
}

function toggleVoiceFeedback() {
  state.voiceFeedbackEnabled = !state.voiceFeedbackEnabled;
  const voiceBtn = document.getElementById('btn-voice-toggle');
  if (voiceBtn) {
    voiceBtn.textContent = state.voiceFeedbackEnabled ? '🔊' : '🔇';
  }
  showToast(state.voiceFeedbackEnabled ? '🔊' : '🔇', state.voiceFeedbackEnabled ? 'Voice Feedback Enabled' : 'Voice Feedback Disabled');
}

