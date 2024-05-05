const  getMonthDateRanges = ()=> {
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
        currentMonth: {
            start: firstDayCurrentMonth,
            end: lastDayCurrentMonth
        },
        lastMonth: {
            start: firstDayLastMonth,
            end: lastDayLastMonth
        }
    };
}


module.exports= getMonthDateRanges;