(()=>{
  const id=window.SITE_CONFIG?.googleAnalyticsMeasurementId;
  if(!id || !/^G-[A-Z0-9]+$/i.test(id)) return;

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());
  window.gtag('config',id,{
    allow_google_signals:false,
    allow_ad_personalization_signals:false
  });

  const script=document.createElement('script');
  script.async=true;
  script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
  document.head.appendChild(script);
})();
