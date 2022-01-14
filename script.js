'use strict';

// prettier-ignore

/////////////////////////////////////////////////////
///////////////// Workout Classes ///////////////////
/////////////////////////////////////////////////////

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min
    
  }

  _setDescription() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    this.description = `${this.type === 'running' ? 'Corrida' : 'Ciclismo'} em ${this.date.getDate()} de ${months[this.date.getMonth()]}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  // Aqui calculamos o ritmo, duração / distancia.
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  // Aqui calculamos a velocidade, distancia / (duraçãoHoras / 60).
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

/////////////////////////////////////////////////////
///////////// Arquiterura da aplicação //////////////
/////////////////////////////////////////////////////

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// Essa classe app englobara todos os metodos que controlarão nosso app
class App {
  // Precisamos de acesso a essas duas variaveis fora de seus escopes, por isso criamos elas aqui antes de redefinilas dentro de suas respectivas funções para termos acesso em outros metodos.

  // Na OOP em Javascript quando lidamos com event handlers é importantissimo sempre prestar atençao nas this e para onde elas apontam já que ao usar event handlers a this sempre se torna o objeto no qual ela está sendo chamada e isso vai causar erros, por isso é IMPORTANTISSIMO sempre usar .bind para deixarmos claro ao código que queremos a this sendo o objeto App nesse caso.

  #map;
  #mapEvent;
  #workouts = [];

  // Ao usarmos o constructor para criar um novo objeto do app o _getPosition é invocada e desencadeia os outros metodos.
  constructor() {
    // Descobrir a posição do usuario
    this._getPosition();

    // Pegar data do local storage
    this._getLocalStorage();

    // Adicionar event handlers
    // this em um event handler como addEventListener vai apontar para o form, que é aonde estamos chamando ele, temos que usar bind para fazermos ela apontar para a class, caso contrario não teremos acesso as variaveis map e mapEvent
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    // Aqui checamos se o navegador suporta geolocation, caso suporte executamos a lógica dentro do if
    if (navigator.geolocation)
      //Em getCurrentPosition precisamos passar duas funções, uma que será executada caso seja possivel saber a posição atual atraves do navegador e outra caso falhe.
      // Usamos this para executar o metodo _loadMap como callback dentro da getCurrentPosition
      navigator.geolocation.getCurrentPosition(
        // Aqui usamos bind para dizer a function que queremos a class App como a this keyword, caos contrario a this de uma function call normal é undefined.
        this._loadMap.bind(this),
        function () {
          alert('Não foi possivel lozalizar sua posição.');
        }
      );
  }

  _loadMap(position) {
    // aqui pegamos a latitude e longitude do objeto fornecido pelo geolocation usando destructuring e guardamos ambos um suas variaveis.
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // aqui criamos uma array as duas variaveis criadas anteriormente com os dados.
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, 15);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Leaflet possui seu próprio eventlistener para que fique registrado aonde clicamos no mapa, aqui adicionamos ele ao map com a callback function para criar um marcador no local aonde clicamos.
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    // aqui acessamos o evento ao clickar no mapa, evento esse que nos devolve as coordenadas, guardamos ela em variaveis usando deconstruct e usamos elas para colocar o marker.
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
        ' ';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    // Quando usamos rest como argumento ele aceita um array, .every é um metodo bem util que faz um loop na array testando se uma condição é valida para todos os itens dela, caso seja, devolve true, caso contrário false.
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    // Pegar dados do form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // Se o workout for running, criar objeto running
    // No Javascript moderno if/else não é mais tão utilizado, o ideal é usar varios ifs.
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Checar se os dados são validos
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        // Aqui nós estamos invertendo a condição e não testando para o positivo, caso o teste do validInputs não seja true, ele retorna a função imediatamente.
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Os numeros precisam ser positivos!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // Se o workout for cycling, criar objeto cycling
    if (type === 'cycling') {
      // Checar se os dados são validos
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration, elevation)
      )
        return alert('Os numeros precisam ser positivos!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Adicionar novo objeto ao workout array
    this.#workouts.push(workout);
    // Renderizar workout no mapa com marcador
    this._renderWorkoutMarker(workout);
    // Renderizar workout na lista
    this._renderWorkout(workout);

    // Esconder o form + Limpar forms
    this._hideForm();

    //Configurar local storage para todos os workouts
    this._setLocalStorage();
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
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
          <li class="workout workout--${workout.type}" data-id="${workout.id}">
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
          </div>
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

      form.insertAdjacentHTML('afterend', html);
    }

    if (workout.type === 'cycling') {
      html += `
      <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
      `;

      form.insertAdjacentHTML('afterend', html);
    }
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, 16, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // workout.click();
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

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

// Aqui inicializamos o app, criamos o objeto app como o constructor é invocado ele dá inicio a lógica.
const app = new App();
