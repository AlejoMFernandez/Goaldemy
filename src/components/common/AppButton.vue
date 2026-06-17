<script setup>
// Forward attributes (like class, type) to the button element
defineOptions({ inheritAttrs: false })
</script>

<template>
    <button
        v-bind="$attrs"
        class="my-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 active:translate-y-px"
    >
        <slot />
    </button>
</template>
