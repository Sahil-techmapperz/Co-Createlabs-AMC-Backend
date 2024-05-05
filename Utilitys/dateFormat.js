const correctDateFormat = (dateString) => {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) ? date : null;
  };


  module.exports= correctDateFormat;