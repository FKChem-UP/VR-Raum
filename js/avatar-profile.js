"use strict";

(function () {
  const styles = ["hat", "monocle", "cape", "glasses", "mohawk", "hair", "crown", "antenna", "headband", "none"];
  const forms = ["classic", "slim", "broad", "round", "tall", "compact", "oval"];
  const colors = ["#31749b", "#ac406c", "#397d51", "#bd6030", "#7063a8", "#246f71", "#925333"];
  const choices = {form: forms, color: colors, style: styles};
  function normalize(value) {
    const profile = value || {};
    return {
      name: typeof profile.name === "string" ? Array.from(profile.name.replace(/[\p{Cc}\p{Cf}]/gu, "").trim()).slice(0, 24).join("") : "",
      form: forms.includes(profile.form) ? profile.form : "",
      color: colors.includes(profile.color) ? profile.color : "",
      style: styles.includes(profile.style) ? profile.style : ""
    };
  }
  function available(profiles) {
    return Object.fromEntries(Object.entries(choices).map(([key, values]) => [key,
      values.filter(value => !profiles.some(profile => profile[key] === value))]));
  }
  const api = {normalize, available, choices};
  if (typeof module === "object") module.exports = api;
  else window.FKCVR.AvatarProfile = api;
})();