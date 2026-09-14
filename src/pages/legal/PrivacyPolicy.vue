<script setup>
import FulvoLogo from '../../components/FulvoLogo.vue'
import PrivacyContent from '../../components/legal/PrivacyContent.vue'
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>

    <div class="relative z-10 max-w-3xl mx-auto px-6 pb-16">
      <div class="mb-8 flex flex-col items-center text-center">
        <FulvoLogo variant="icon" size="lg" class="mb-4" />
      </div>

      <PrivacyContent />
    </div>
  </section>
</template>
