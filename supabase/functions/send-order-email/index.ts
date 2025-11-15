import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

interface OrderEmailData {
  customerEmail: string
  customerName: string
  planName: string
  price: number
  orderId: number
}

serve(async (req) => {
  try {
    const { customerEmail, customerName, planName, price, orderId }: OrderEmailData = await req.json()

    // Odeslání emailu přes Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Alatyr Hosting <orders@alatyr.cz>',
        to: [customerEmail],
        subject: `Potvrzení objednávky #${orderId} - ${planName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .order-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
                .order-row:last-child { border-bottom: none; }
                .label { font-weight: bold; color: #6b7280; }
                .value { color: #111827; }
                .total { font-size: 1.2em; font-weight: bold; color: #2563eb; }
                .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 0.9em; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Děkujeme za vaši objednávku!</h1>
                </div>
                <div class="content">
                  <p>Dobrý den ${customerName},</p>
                  <p>Vaše objednávka byla úspěšně přijata a je nyní zpracovávána.</p>

                  <div class="order-details">
                    <h2>Detail objednávky</h2>
                    <div class="order-row">
                      <span class="label">Číslo objednávky:</span>
                      <span class="value">#${orderId}</span>
                    </div>
                    <div class="order-row">
                      <span class="label">Hosting plán:</span>
                      <span class="value">${planName}</span>
                    </div>
                    <div class="order-row">
                      <span class="label">Cena:</span>
                      <span class="value total">${price} Kč</span>
                    </div>
                  </div>

                  <p>V nejbližší době vás budeme kontaktovat s dalšími instrukcemi pro:</p>
                  <ul>
                    <li>Provedení platby</li>
                    <li>Nastavení hostingu</li>
                    <li>Přístupové údaje do správy</li>
                  </ul>

                  <p style="text-align: center;">
                    <a href="https://alatyr.cz/dashboard" class="button">Přejít do dashboardu</a>
                  </p>

                  <p>Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat na <a href="mailto:support@alatyr.cz">support@alatyr.cz</a>.</p>

                  <p>S pozdravem,<br><strong>Tým Alatyr Hosting</strong></p>
                </div>
                <div class="footer">
                  <p>Tento email byl odeslán automaticky. Prosím neodpovídejte na něj.</p>
                  <p>&copy; 2025 Alatyr Hosting. Všechna práva vyhrazena.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(
      JSON.stringify({ success: true, emailId: data.id }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
