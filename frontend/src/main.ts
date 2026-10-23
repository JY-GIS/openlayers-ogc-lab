import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import VectorFormatsPage from './pages/VectorFormatsPage.vue'

const rootComponent = window.location.hash === '#/vector-formats'
    ? VectorFormatsPage
    : App

createApp(rootComponent).mount('#app')
