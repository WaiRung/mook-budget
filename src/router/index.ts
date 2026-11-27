import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import AccountingView from '../views/AccountingView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'accounting',
    component: AccountingView,
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  if (to.matched.length === 0) return '/'
})

export default router
