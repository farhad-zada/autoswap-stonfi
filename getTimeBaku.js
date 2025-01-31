module.exports = function getBakuTimeLog() {
    const now = new Date();
    const bakuTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Baku",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3, // For milliseconds
        hour12: false,
    }).format(now);

    return `[${bakuTime.replace(",", "")}] `;
};
