<script setup>
// Forward attributes (like class, type) to the button element
defineOptions({ inheritAttrs: false })
</script>

<template>
    <button
        v-bind="$attrs"
        class="my-1 inline-flex items-center justify-center rounded-xl bg-[oklch(0.62_0.21_270)] px-5 py-2.5 font-semibold text-white shadow-lg shadow-[oklch(0.55_0.21_270)/30] transition hover:bg-[oklch(0.55_0.21_270)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.62_0.21_270)/40] active:translate-y-px"
    >
        <slot />
    </button>
</template>