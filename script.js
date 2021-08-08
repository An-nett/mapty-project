'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllButton = document.querySelector('.sidebar .btn-delete');
const weatherContainer = document.querySelector('.weather');
const dayTemp = weatherContainer.querySelector('.weather__day');
const nightTemp = weatherContainer.querySelector('.weather__night');
const preloader = document.querySelector('.preloader');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  constructor(coords, duration, distance) {
    this.coords = coords;
    this.duration = duration;
    this.distance = distance;
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, duration, distance, cadence) {
    super(coords, duration, distance);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, duration, distance, elevationGain) {
    super(coords, duration, distance);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//Application Architecture

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvt;
  #workouts = [];
  constructor() {
    this._getCurrentPosition();
    this._getLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    deleteAllButton.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );
    if (this.#workouts.length !== 0) this._showDeleteButton();
  }

  _getCurrentPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude: lat } = position.coords;
    const { longitude: lon } = position.coords;

    this._loadWeather(lat, lon);

    const coords = [lat, lon];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  async _loadWeather(lat, lon) {
    try {
      let res, data;
      async function fetchData() {
        res = await fetch(
          `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=civillight&output=json`
        );
        if (!res) throw new Error('Could not get data');
        if (res && !res.ok) {
          throw new Error(`Something went wrong (${res.status})`);
        }
        data = await res.json();
        return data;
      }

      await Promise.race([fetchData(), this._weatherDataTimeout()]);

      const weatherDescription = data.dataseries[0].weather;
      const weatherImg = document.createElement('img');

      weatherImg.src = `imgs/icon-${weatherDescription}.png`;
      weatherImg.alt = `${weatherDescription}`;
      weatherImg.addEventListener('load', this._showWeather(data, weatherImg));
    } catch (e) {
      console.error(e);
      weatherContainer.textContent = `⚠${e.message}`;
      preloader.style.display = 'none';
      weatherContainer.classList.remove('invisible');
    }
  }

  _weatherDataTimeout() {
    return new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Timed out!'));
      }, 10000);
    });
  }

  _showWeather(data, img) {
    weatherContainer.append(img);

    let max = data.dataseries[0].temp2m.max;
    let min = data.dataseries[0].temp2m.min;

    if (max > 0) max = '+' + max;
    if (min > 0) min = '+' + min;

    dayTemp.textContent = max;
    nightTemp.textContent = min;
    preloader.classList.add('invisible');

    setTimeout(function () {
      preloader.style.display = 'none';
      weatherContainer.classList.remove('invisible');
    }, 800);
  }

  _showForm(mapE) {
    this.#mapEvt = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    //prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(evt) {
    evt.preventDefault();

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const cadence = +inputCadence.value;
    const elevation = +inputElevation.value;
    const { lat, lng } = this.#mapEvt.latlng;
    let workout;

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const positiveNumbers = (...inputs) => inputs.every(inp => inp > 0);

    if (type === 'running') {
      if (
        !validInputs(distance, duration, cadence) ||
        !positiveNumbers(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');
      workout = new Running([lat, lng], duration, distance, cadence);
    }

    if (type === 'cycling') {
      if (
        !validInputs(distance, duration, elevation) ||
        !positiveNumbers(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], duration, distance, elevation);
    }

    this.#workouts.push(workout);
    this._renderWorkout(workout);
    this._renderWorkoutMarker(workout);
    this._hideForm();
    this._setLocalStorage();
    if (this.#workouts.length === 1) this._showDeleteButton();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}${workout.description}`
      )
      .openPopup();
  }

  _renderMarkersList() {
    this.#map.eachLayer(layer => {
      if (layer.getPane().classList.contains('leaflet-marker-pane'))
        layer.remove();
    });
    this.#workouts.forEach(workout => this._renderWorkoutMarker(workout));
  }

  _renderWorkout(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
     <h2 class="workout__title">${workout.description}</h2>
     <div class="workout__details">
       <span class="workout__icon">${
         workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
       }</span>
       <span class="workout__value">${workout.distance}</span>
       <span class="workout__unit">km</span>
     </div>
     <div class="workout__details">
       <span class="workout__icon">⏱</span>
       <span class="workout__value">${workout.duration}</span>
       <span class="workout__unit">min</span>
     </div>`;

    if (workout.type === 'running') {
      html += `<div class="workout__details">
         <span class="workout__icon">⚡️</span>
         <span class="workout__value">${workout.pace.toFixed(1)}</span>
         <span class="workout__unit">min/km</span>
       </div>
       <div class="workout__details">
         <span class="workout__icon">🦶🏼</span>
         <span class="workout__value">${workout.cadence}</span>
         <span class="workout__unit">spm</span>
       </div>
       <button type="button" class="close-button">x</button>
     </li>`;
    }

    if (workout.type === 'cycling') {
      html += `<div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
      <button type="button" class="close-button">x</button>
    </li>`;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _deleteWorkout(evt) {
    if (!evt.target.classList.contains('close-button')) return;

    //Find the right workout to delete
    const workoutToDeleteId = evt.target.closest('.workout').dataset.id;
    const workoutToDelete = this.#workouts.find(
      work => work.id === workoutToDeleteId
    );
    const workoutToDeleteIndex = this.#workouts.indexOf(workoutToDelete);

    //Delete workout from #workouts array
    this.#workouts.splice(workoutToDeleteIndex, 1);

    this._renderWorkoutsList();
    this._renderMarkersList();
    this._setLocalStorage();
    if (this.#workouts.length === 0) this._hideDeleteButton();
  }

  _renderWorkoutsList() {
    const workoutsEl = containerWorkouts.querySelectorAll('.workout');
    workoutsEl.forEach(work => work.remove());
    this.#workouts.forEach(work => this._renderWorkout.bind(this)(work));
  }

  _moveToPopup(evt) {
    const workoutEl = evt.target.closest('.workout');
    if (!workoutEl) return;
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animation: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _deleteAllWorkouts() {
    this.#workouts = [];
    this._renderWorkoutsList();
    this._renderMarkersList();
    this._setLocalStorage();
    this._hideDeleteButton();
  }

  _hideDeleteButton() {
    deleteAllButton.classList.add('hidden');
  }

  _showDeleteButton() {
    deleteAllButton.classList.remove('hidden');
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
