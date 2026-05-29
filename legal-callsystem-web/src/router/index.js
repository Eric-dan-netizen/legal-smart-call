import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue'
import Dashboard from '../views/Dashboard.vue'
import Customers from '../views/Customers.vue'
import Tasks from '../views/Tasks.vue'
import Scripts from '../views/Scripts.vue'
import Statistics from '../views/Statistics.vue'
import CallLogs from '../views/CallLogs.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login, meta: { noAuth: true } },
  {
    path: '/',
    component: Layout,
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'customers', component: Customers },
      { path: 'tasks', component: Tasks },
      { path: 'call-logs', component: CallLogs },
      { path: 'scripts', component: Scripts },
      { path: 'statistics', component: Statistics },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.noAuth) {
    next()
    return
  }
  const token = localStorage.getItem('token')
  if (!token || token === 'undefined') {
    next('/login')
    return
  }
  next()
})

export default router
